import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Un événement du calendrier, normalisé pour le frontend.
 * `partner_busy` = créneau privé du partenaire : OPAQUE (aucun titre).
 */
type CalendarEvent =
  | {
      id: string;
      visibility: 'mine' | 'ours';
      title: string;
      status: string;
      description: string | null;
      start: string;
      end: string | null;
      isAllDay: boolean;
    }
  | {
      id: string;
      visibility: 'partner_busy';
      start: string;
      end: string | null;
      isAllDay: boolean;
    };

/**
 * GET /api/calendar?from=<ISO>&to=<ISO>
 * Renvoie les événements datés du couple qui chevauchent la fenêtre,
 * en appliquant la confidentialité CÔTÉ SERVEUR :
 *  - mes tâches privées : complètes
 *  - tâches communes     : complètes
 *  - tâches privées du partenaire : opaques (« Occupé », sans titre)
 */
export async function getCalendar(req: Request, res: Response) {
  const { userId, coupleId } = req.auth!;
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (!fromDate || !toDate || isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'Paramètres "from" et "to" (ISO) requis' });
  }

  // Toutes les tâches datées du couple qui chevauchent [from, to].
  // Chevauchement : start <= to ET (end >= from OU end null avec start >= from).
  const tasks = await prisma.task.findMany({
    where: {
      environment: { coupleId },
      startDatetime: { not: null, lte: toDate },
      OR: [{ endDatetime: { gte: fromDate } }, { endDatetime: null, startDatetime: { gte: fromDate } }],
    },
    include: { environment: { select: { type: true, userId: true } } },
    orderBy: { startDatetime: 'asc' },
  });

  const events: CalendarEvent[] = tasks.map((t) => {
    const start = t.startDatetime!.toISOString();
    const end = t.endDatetime ? t.endDatetime.toISOString() : null;

    // Tâche privée du partenaire → on ne divulgue RIEN d'autre que le créneau
    const isPartnerPrivate = t.environment.type === 'PRIVATE' && t.environment.userId !== userId;
    if (isPartnerPrivate) {
      return { id: t.id, visibility: 'partner_busy', start, end, isAllDay: t.isAllDay };
    }

    return {
      id: t.id,
      visibility: t.environment.type === 'SHARED' ? 'ours' : 'mine',
      title: t.title,
      status: t.status,
      description: t.description,
      start,
      end,
      isAllDay: t.isAllDay,
    };
  });

  return res.json({ events });
}
