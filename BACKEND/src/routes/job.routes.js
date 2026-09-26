import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import {
  handleAssignTechnician, handleCompleteJob, handleCreateJob, handleUpdateJobStatus,
} from '../controllers/job.controller.js';

const router = Router();
router.use(authenticateToken);
router.post('/', requireRole('OWNER'), handleCreateJob);
router.patch('/:id/assign', requireRole('OWNER'), handleAssignTechnician);
router.patch('/:id/status', requireRole('OWNER', 'TECHNICIAN'), handleUpdateJobStatus);
router.patch('/:id/complete', requireRole('OWNER', 'TECHNICIAN'), handleCompleteJob);

export default router;
