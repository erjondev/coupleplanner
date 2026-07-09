import { Request, Response } from 'express';
import { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hasPartnerPrivateConflict } from '../services/conflict.service';
import { analyseVoiceTextAI } from '../services/voiceAnalyseAI.service';

const CONFLICT_MESSAGE = 'Le partenaire a déjà un engagement privé sur ce créneau';

/** Récupère l'id du partenaire dans le couple (ou null). */
async function getPartnerId(userId: string, coupleId: string): Promise<string | null> {
  const partner = await prisma.user.findFirst({
    where: { coupleId, id: { not: userId } },
    select: { id: true },
  });
  return partner?.id ?? null;
}

/**
 * GET /api/tasks?space=mine|ours|partner
 *  - mine    : tâches de MON environnement privé ("Mon Espace")
 *  - ours    : tâches de l'environnement commun ("Notre Espace")
 *  - partner : tâches communes assignées au partenaire ("Son Espace")
 */
export async function listTasks(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const space = (req.query.space as string) ?? 'ours';

  let where: Prisma.TaskWhereInput;
  switch (space) {
    case 'mine':
      where = { environment: { coupleId, type: 'PRIVATE', userId } };
      break;
    case 'partner': {
      const partnerId = await getPartnerId(userId, coupleId);
      where = { environment: { coupleId, type: 'SHARED' }, assignedTo: partnerId ?? '__none__' };
      break;
    }
    case 'ours':
    default:
      where = { environment: { coupleId, type: 'SHARED' } };
      break;
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ startDatetime: 'asc' }, { createdAt: 'desc' }],
    include: { assignee: { select: { id: true, name: true } } },
  });

  return res.json({ tasks });
}

/**
 * POST /api/tasks
 * Body : {
 *   title, description?, environment_type: 'PRIVATE'|'SHARED',
 *   assign_to_partner?: boolean, start_datetime?, end_datetime?, is_all_day?
 * }
 *
 * Logique de conflit : si la tâche est SHARED avec un créneau horaire,
 * on vérifie les tâches PRIVÉES du partenaire sur le même créneau.
 * La tâche est créée dans tous les cas, mais la réponse contient
 * `has_conflict: true` + un message générique (pas de fuite du titre privé).
 */
export async function createTask(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const {
    title,
    description,
    environment_type: environmentType,
    assign_to_partner: assignToPartner,
    start_datetime: startRaw,
    end_datetime: endRaw,
    is_all_day: isAllDay,
  } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Le titre est requis' });
  }
  if (environmentType !== 'PRIVATE' && environmentType !== 'SHARED') {
    return res.status(400).json({ error: 'environment_type doit être PRIVATE ou SHARED' });
  }

  // Résolution de l'environnement cible
  const environment = await prisma.environment.findFirst({
    where:
      environmentType === 'PRIVATE'
        ? { coupleId, type: 'PRIVATE', userId }
        : { coupleId, type: 'SHARED' },
  });
  if (!environment) {
    return res.status(404).json({ error: 'Environnement introuvable pour ce couple' });
  }

  // Normalisation du créneau : une tâche "journée entière" occupe 00:00 -> 23:59
  let start = startRaw ? new Date(startRaw) : null;
  let end = endRaw ? new Date(endRaw) : null;
  if (start && !end) {
    end = new Date(start);
    if (isAllDay) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      end.setHours(end.getHours() + 1); // durée par défaut : 1h
    }
  }

  // --- Détection de conflit (exigence métier) ---
  let hasConflict = false;
  if (environmentType === 'SHARED' && start && end) {
    hasConflict = await hasPartnerPrivateConflict(userId, coupleId, start, end);
  }

  const partnerId = assignToPartner ? await getPartnerId(userId, coupleId) : null;

  const task = await prisma.task.create({
    data: {
      environmentId: environment.id,
      title: title.trim(),
      description: description ?? null,
      startDatetime: start,
      endDatetime: end,
      isAllDay: Boolean(isAllDay),
      createdBy: userId,
      assignedTo: environmentType === 'PRIVATE' ? userId : partnerId,
    },
    include: { assignee: { select: { id: true, name: true } } },
  });

  return res.status(201).json({
    task,
    has_conflict: hasConflict,
    ...(hasConflict && { message: CONFLICT_MESSAGE }),
  });
}

/**
 * PATCH /api/tasks/:id — mise à jour partielle d'une tâche.
 * Champs acceptés (tous optionnels) : status, title, description,
 * start_datetime, end_datetime, is_all_day.
 *
 * Si le créneau d'une tâche SHARED change, on relance la détection de conflit
 * (même règle qu'à la création) et on renvoie `has_conflict`.
 */
export async function updateTask(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const { id } = req.params;
  const {
    status,
    title,
    description,
    start_datetime: startRaw,
    end_datetime: endRaw,
    is_all_day: isAllDay,
  } = req.body;

  // Sécurité : la tâche doit appartenir au couple de l'utilisateur
  const existing = await prisma.task.findFirst({
    where: { id, environment: { coupleId } },
    include: { environment: { select: { type: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });

  const data: Prisma.TaskUncheckedUpdateInput = {};

  if (status !== undefined) {
    if (!Object.values(TaskStatus).includes(status)) {
      return res.status(400).json({ error: 'Statut invalide (TODO, IN_PROGRESS, DONE)' });
    }
    data.status = status;
  }
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Le titre ne peut pas être vide' });
    }
    data.title = title.trim();
  }
  if (description !== undefined) data.description = description ?? null;

  // Champs de créneau (parsés séparément pour la détection de conflit)
  const newAllDay = isAllDay !== undefined ? Boolean(isAllDay) : undefined;
  const newStart = startRaw !== undefined ? (startRaw ? new Date(startRaw) : null) : undefined;
  let newEnd = endRaw !== undefined ? (endRaw ? new Date(endRaw) : null) : undefined;

  // Créneau effectif après mise à jour (valeurs fournies, sinon existantes)
  const effAllDay = newAllDay ?? existing.isAllDay;
  const effStart = newStart !== undefined ? newStart : existing.startDatetime;
  let effEnd = newEnd !== undefined ? newEnd : existing.endDatetime;

  // Si on a un début sans fin, on dérive la fin (journée entière ou +1h)
  if (effStart && !effEnd) {
    effEnd = new Date(effStart);
    if (effAllDay) {
      effStart.setHours(0, 0, 0, 0);
      effEnd.setHours(23, 59, 59, 999);
    } else {
      effEnd.setHours(effEnd.getHours() + 1);
    }
    newEnd = effEnd; // sera persisté
  }

  if (newAllDay !== undefined) data.isAllDay = newAllDay;
  if (newStart !== undefined) data.startDatetime = effStart;
  if (newEnd !== undefined) data.endDatetime = effEnd;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  // Détection de conflit si le créneau d'une tâche SHARED a changé
  const timesTouched =
    newStart !== undefined || newEnd !== undefined || newAllDay !== undefined;
  let hasConflict = false;
  if (existing.environment.type === 'SHARED' && timesTouched && effStart && effEnd) {
    hasConflict = await hasPartnerPrivateConflict(userId, coupleId, effStart, effEnd);
  }

  const task = await prisma.task.update({
    where: { id },
    data,
    include: { assignee: { select: { id: true, name: true } } },
  });

  return res.json({
    task,
    has_conflict: hasConflict,
    ...(hasConflict && { message: CONFLICT_MESSAGE }),
  });
}

/** DELETE /api/tasks/:id — supprime une tâche du couple. */
export async function deleteTask(req: Request, res: Response) {
  const { coupleId } = req.auth!;
  const { id } = req.params;

  // Sécurité : la tâche doit appartenir au couple de l'utilisateur
  const existing = await prisma.task.findFirst({
    where: { id, environment: { coupleId } },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });

  await prisma.task.delete({ where: { id } });
  return res.status(204).send();
}

/**
 * POST /api/tasks/voice-analyse
 * Body : { text: string } (résultat brut d'un Speech-to-Text)
 * Renvoie un JSON structuré simulant l'analyse d'un LLM.
 */
export async function voiceAnalyse(req: Request, res: Response) {
  const { text } = req.body as { text?: string };
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Le champ "text" est requis' });
  }
  const analysis = await analyseVoiceTextAI(text);
  return res.json(analysis);
}
