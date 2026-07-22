import { Request, Response } from 'express';
import { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hasPartnerPrivateConflict } from '../services/conflict.service';
import { analyseVoiceTextAI } from '../services/voiceAnalyseAI.service';

const CONFLICT_MESSAGE = 'Le partenaire a déjà un engagement privé sur ce créneau';
const READONLY_MESSAGE = 'Cette tâche est assignée à votre partenaire : lecture seule';

// Statuts de proposition qui masquent la tâche des espaces/agenda : tant qu'elle
// n'est pas acceptée (PENDING) ou qu'elle a été refusée (DECLINED), elle ne vit
// que dans l'onglet « Propositions ».
const HIDDEN_PROPOSAL_STATUSES: Prisma.EnumProposalStatusFilter = {
  in: ['PENDING', 'DECLINED'],
};

/**
 * Une tâche n'est modifiable/supprimable que si elle m'est assignée ou n'est
 * assignée à personne (tâche commune). Une tâche assignée au partenaire est en
 * lecture seule.
 */
function isReadOnlyFor(userId: string, assignedTo: string | null): boolean {
  return assignedTo !== null && assignedTo !== userId;
}

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

  // Les propositions en attente/refusées ne figurent dans aucun espace : elles
  // sont réservées à l'onglet « Propositions » jusqu'à validation.
  where.NOT = { proposalStatus: HIDDEN_PROPOSAL_STATUSES };

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
    is_proposal: isProposalRaw,
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

  // Une proposition est toujours une activité commune (SHARED), en attente de
  // validation du partenaire. On force donc l'espace commun quel que soit le
  // champ reçu, et on refuse la proposition s'il n'y a pas de partenaire.
  const isProposal = Boolean(isProposalRaw);
  const effectiveType = isProposal ? 'SHARED' : environmentType;

  if (isProposal) {
    const partnerId = await getPartnerId(userId, coupleId);
    if (!partnerId) {
      return res.status(400).json({ error: 'Aucun partenaire à qui proposer cette activité' });
    }
  }

  // Résolution de l'environnement cible
  const environment = await prisma.environment.findFirst({
    where:
      effectiveType === 'PRIVATE'
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
  if (effectiveType === 'SHARED' && start && end) {
    hasConflict = await hasPartnerPrivateConflict(userId, coupleId, start, end);
  }

  // Une proposition reste commune (assignedTo = null) : une fois acceptée, elle
  // devient une tâche de « Notre Espace ».
  const partnerId = !isProposal && assignToPartner ? await getPartnerId(userId, coupleId) : null;

  const task = await prisma.task.create({
    data: {
      environmentId: environment.id,
      title: title.trim(),
      description: description ?? null,
      startDatetime: start,
      endDatetime: end,
      isAllDay: Boolean(isAllDay),
      createdBy: userId,
      assignedTo: effectiveType === 'PRIVATE' ? userId : partnerId,
      proposalStatus: isProposal ? 'PENDING' : 'NONE',
    },
    include: { assignee: { select: { id: true, name: true } } },
  });

  return res.status(201).json({
    task,
    has_conflict: hasConflict,
    ...(isProposal && { message: 'Proposition envoyée à votre partenaire' }),
    ...(!isProposal && hasConflict && { message: CONFLICT_MESSAGE }),
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
  if (isReadOnlyFor(userId, existing.assignedTo)) {
    return res.status(403).json({ error: READONLY_MESSAGE });
  }

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
  const { userId, coupleId } = req.auth!;
  const { id } = req.params;

  // Sécurité : la tâche doit appartenir au couple de l'utilisateur
  const existing = await prisma.task.findFirst({
    where: { id, environment: { coupleId } },
    select: { id: true, assignedTo: true },
  });
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable' });
  if (isReadOnlyFor(userId, existing.assignedTo)) {
    return res.status(403).json({ error: READONLY_MESSAGE });
  }

  await prisma.task.delete({ where: { id } });
  return res.status(204).send();
}

/**
 * GET /api/tasks/proposals
 * Renvoie les propositions d'activité du couple, séparées en deux listes :
 *  - received : propositions PENDING dont je ne suis PAS l'émetteur
 *               (à accepter/refuser).
 *  - sent     : propositions que J'AI émises, encore en attente (PENDING) ou
 *               refusées par le partenaire (DECLINED, pour feedback).
 */
export async function listProposals(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;

  const [received, sent] = await Promise.all([
    prisma.task.findMany({
      where: {
        environment: { coupleId },
        proposalStatus: 'PENDING',
        createdBy: { not: userId },
      },
      orderBy: [{ startDatetime: 'asc' }, { createdAt: 'desc' }],
      include: { creator: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({
      where: {
        environment: { coupleId },
        createdBy: userId,
        proposalStatus: { in: ['PENDING', 'DECLINED'] },
      },
      orderBy: [{ startDatetime: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return res.json({ received, sent });
}

/**
 * Charge une proposition PENDING que l'utilisateur courant est habilité à
 * traiter (accepter/refuser) : elle doit appartenir au couple, être en attente,
 * et NE PAS avoir été émise par lui-même (on ne valide pas sa propre proposition).
 */
async function findPendingProposalForRecipient(id: string, userId: string, coupleId: string) {
  return prisma.task.findFirst({
    where: {
      id,
      environment: { coupleId },
      proposalStatus: 'PENDING',
      createdBy: { not: userId },
    },
  });
}

/**
 * POST /api/tasks/:id/proposal/accept
 * Le partenaire destinataire valide la proposition : elle devient une tâche
 * commune ordinaire (ACCEPTED) et réapparaît dans l'agenda / « Notre Espace ».
 * On relance la détection de conflit à l'acceptation.
 */
export async function acceptProposal(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const { id } = req.params;

  const proposal = await findPendingProposalForRecipient(id, userId, coupleId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposition introuvable ou déjà traitée' });
  }

  let hasConflict = false;
  if (proposal.startDatetime && proposal.endDatetime) {
    hasConflict = await hasPartnerPrivateConflict(
      userId,
      coupleId,
      proposal.startDatetime,
      proposal.endDatetime
    );
  }

  const task = await prisma.task.update({
    where: { id },
    data: { proposalStatus: 'ACCEPTED' },
    include: { assignee: { select: { id: true, name: true } } },
  });

  return res.json({
    task,
    has_conflict: hasConflict,
    ...(hasConflict && { message: CONFLICT_MESSAGE }),
  });
}

/**
 * POST /api/tasks/:id/proposal/decline
 * Le partenaire destinataire refuse : la proposition passe en DECLINED. Elle
 * disparaît de sa vue mais reste visible de l'émetteur (feedback), qui pourra
 * la supprimer via DELETE /api/tasks/:id.
 */
export async function declineProposal(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const { id } = req.params;

  const proposal = await findPendingProposalForRecipient(id, userId, coupleId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposition introuvable ou déjà traitée' });
  }

  const task = await prisma.task.update({
    where: { id },
    data: { proposalStatus: 'DECLINED' },
  });

  return res.json({ task });
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
