import { Request, Response } from 'express';
import { buildCoupleCalendarEvents } from '../services/calendarEvents.service';

/**
 * GET /api/calendar?from=<ISO>&to=<ISO>
 * Renvoie les événements datés du couple qui chevauchent la fenêtre,
 * en appliquant la confidentialité CÔTÉ SERVEUR (cf. buildCoupleCalendarEvents) :
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

  const events = await buildCoupleCalendarEvents(coupleId, userId, fromDate, toDate);
  return res.json({ events });
}
