import { Router } from 'express';
import {
  acceptProposal,
  createTask,
  declineProposal,
  deleteTask,
  listProposals,
  listTasks,
  updateTask,
  voiceAnalyse,
} from '../controllers/tasks.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listTasks);
router.get('/proposals', listProposals);
router.post('/', createTask);
router.post('/voice-analyse', voiceAnalyse);
router.post('/:id/proposal/accept', acceptProposal);
router.post('/:id/proposal/decline', declineProposal);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
