import { prisma } from '../lib/prisma';

/**
 * Un événement du calendrier, normalisé.
 * `partner_busy` = créneau privé du partenaire : OPAQUE (aucun titre).
 */
export type CalendarEvent =
  | {
      id: string;
      visibility: 'mine' | 'ours';
      title: string;
      status: string;
      description: string | null;
      start: string;
      end: string | null;
      isAllDay: boolean;
      /** À qui la tâche est assignée (null = commune). Sert au contrôle « lecture seule ». */
      assignedTo: string | null;
    }
  | {
      id: string;
      visibility: 'partner_busy';
      start: string;
      end: string | null;
      isAllDay: boolean;
    };

/**
 * Récupère les événements datés du couple qui chevauchent [from, to], en
 * appliquant la confidentialité CÔTÉ SERVEUR (source unique de vérité,
 * partagée par l'API JSON et le flux ICS) :
 *  - mes tâches privées : complètes
 *  - tâches communes     : complètes
 *  - tâches privées du partenaire : opaques (« Occupé », sans titre)
 *
 * Ne JAMAIS sélectionner d'autre champ de l'espace PRIVATE du partenaire que
 * le créneau horaire (cf. règle de confidentialité, CLAUDE.md).
 */
export async function buildCoupleCalendarEvents(
  coupleId: string,
  userId: string,
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  // Chevauchement : start <= to ET (end >= from OU end null avec start >= from).
  const tasks = await prisma.task.findMany({
    where: {
      environment: { coupleId },
      startDatetime: { not: null, lte: to },
      OR: [{ endDatetime: { gte: from } }, { endDatetime: null, startDatetime: { gte: from } }],
      // Une proposition en attente/refusée n'est pas encore un engagement :
      // elle n'apparaît dans l'agenda qu'une fois acceptée.
      NOT: { proposalStatus: { in: ['PENDING', 'DECLINED'] } },
    },
    include: { environment: { select: { type: true, userId: true } } },
    orderBy: { startDatetime: 'asc' },
  });

  return tasks.map((t) => {
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
      assignedTo: t.assignedTo,
    };
  });
}
