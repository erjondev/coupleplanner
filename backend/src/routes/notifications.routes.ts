import { Router } from 'express';
import { registerToken } from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, registerToken);

export default router;
