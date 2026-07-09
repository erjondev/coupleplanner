import { prisma } from '../lib/prisma';

/**
 * Détection de conflit d'agenda.
 *
 * Règle métier : lorsqu'une tâche SHARED est créée sur un créneau,
 * on vérifie si le PARTENAIRE a une tâche PRIVÉE qui chevauche ce créneau.
 * Si oui, on signale un conflit générique SANS divulguer le contenu
 * de la tâche privée (confidentialité de "Mon Espace").
 */
export async function hasPartnerPrivateConflict(
  currentUserId: string,
  coupleId: string,
  start: Date,
  end: Date
): Promise<boolean> {
  const partner = await prisma.user.findFirst({
    where: { coupleId, id: { not: currentUserId } },
    select: { id: true },
  });
  if (!partner) return false;

  // Chevauchement classique : (start < existing.end) ET (end > existing.start)
  const conflictingTask = await prisma.task.findFirst({
    where: {
      environment: { coupleId, type: 'PRIVATE', userId: partner.id },
      status: { not: 'DONE' },
      startDatetime: { lt: end },
      endDatetime: { gt: start },
    },
    select: { id: true }, // on ne récupère volontairement PAS le titre
  });

  return conflictingTask !== null;
}
