import { Router } from 'express';
import { getCalendar } from '../controllers/calendar.controller';
import { getFeed, rotateFeed, getFeedIcs } from '../controllers/calendarFeed.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getCalendar);

// Abonnement ICS : gestion de l'URL (authentifié)…
router.get('/feed', requireAuth, getFeed);
router.post('/feed/rotate', requireAuth, rotateFeed);
// …et service public du flux (le jeton secret dans l'URL fait l'auth).
router.get('/feed/:token.ics', getFeedIcs);

export default router;
