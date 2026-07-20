import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { buildCoupleCalendarEvents } from '../services/calendarEvents.service';
import { buildIcs } from '../services/ics.service';

/** Fenêtre du flux : ~2 mois passés → 1 an futur (jours, en ms). */
const PAST_DAYS = 60;
const FUTURE_DAYS = 365;

/** Génère un jeton secret d'URL (non devinable). */
function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Base publique de l'API. Derrière le proxy alwaysdata, on privilégie
 * PUBLIC_API_URL (ex: "https://coupleplanner.alwaysdata.net") ; à défaut on la
 * reconstruit depuis la requête (en tenant compte du proxy via X-Forwarded-Proto).
 */
function publicBase(req: Request): string {
  const fromEnv = process.env.PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0].trim() || req.protocol;
  return `${proto}://${req.get('host')}`;
}

function feedUrl(req: Request, token: string): string {
  return `${publicBase(req)}/api/calendar/feed/${token}.ics`;
}

/**
 * GET /api/calendar/feed (authentifié)
 * Renvoie l'URL d'abonnement de l'utilisateur, en créant le jeton s'il manque.
 */
export async function getFeed(req: Request, res: Response) {
  const { userId } = req.auth!;
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  if (!user.calendarFeedToken) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { calendarFeedToken: generateToken() },
    });
  }

  return res.json({ url: feedUrl(req, user.calendarFeedToken!) });
}

/**
 * POST /api/calendar/feed/rotate (authentifié)
 * Régénère le jeton : l'ancien lien d'abonnement cesse de fonctionner.
 */
export async function rotateFeed(req: Request, res: Response) {
  const { userId } = req.auth!;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedToken: generateToken() },
  });
  return res.json({ url: feedUrl(req, user.calendarFeedToken!) });
}

/**
 * GET /api/calendar/feed/:token.ics (PUBLIC — pas de requireAuth)
 * Sert le flux iCalendar de l'utilisateur identifié par le jeton secret.
 * Le jeton dans l'URL EST le contrôle d'accès.
 */
export async function getFeedIcs(req: Request, res: Response) {
  const { token } = req.params;
  const user = await prisma.user.findUnique({ where: { calendarFeedToken: token } });
  if (!user || !user.coupleId) {
    return res.status(404).type('text/plain').send('Flux introuvable');
  }

  const now = new Date();
  const from = new Date(now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + FUTURE_DAYS * 24 * 60 * 60 * 1000);

  const events = await buildCoupleCalendarEvents(user.coupleId, user.id, from, to);
  const ics = buildIcs(events, now);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="coupleplanner.ics"');
  // Laisse le fournisseur (Google/Apple) piloter le rafraîchissement, mais évite
  // qu'un cache intermédiaire serve un flux périmé trop longtemps.
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.send(ics);
}
