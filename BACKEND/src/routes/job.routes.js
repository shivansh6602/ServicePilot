import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';
import {
  handleAssignTechnician, handleCompleteJob, handleCreateJob, handleGetAssignedJob, handleGetJobStatusHistory,
  handleGetOwnerJob, handleGetReceipt, handleListAssignedJobs, handleListOwnerJobs, handleRecordPayment, handleUpdateJobStatus,
} from '../controllers/job.controller.js';
import { handleIssueCustomerAccessToken } from '../controllers/customer-access.controller.js';

const router = Router();
router.use(authenticateToken);
router.get('/assigned', requireRole('TECHNICIAN'), handleListAssignedJobs);
router.get('/assigned/:id', requireRole('TECHNICIAN'), handleGetAssignedJob);
router.get('/', requireRole('OWNER'), handleListOwnerJobs);
router.post('/', requireRole('OWNER'), handleCreateJob);
router.patch('/:id/assign', requireRole('OWNER'), handleAssignTechnician);
router.patch('/:id/status', requireRole('OWNER', 'TECHNICIAN'), handleUpdateJobStatus);
router.patch('/:id/complete', requireRole('OWNER', 'TECHNICIAN'), handleCompleteJob);
router.post('/:id/payments', requireRole('OWNER'), handleRecordPayment);
router.get('/:id/receipt', requireRole('OWNER'), handleGetReceipt);
router.get('/:id/status-history', requireRole('OWNER'), handleGetJobStatusHistory);
router.get('/:id', requireRole('OWNER'), handleGetOwnerJob);
router.post(
  '/:id/customer-access',
  requireRole('OWNER'),
  handleIssueCustomerAccessToken,
);
export default router;
