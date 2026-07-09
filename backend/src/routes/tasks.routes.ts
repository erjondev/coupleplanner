import { Router } from 'express';
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  voiceAnalyse,
} from '../controllers/tasks.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listTasks);
router.post('/', createTask);
router.post('/voice-analyse', voiceAnalyse);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
