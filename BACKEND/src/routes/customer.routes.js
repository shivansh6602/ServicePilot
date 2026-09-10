import { Router } from 'express';
import {
  handleCreateCustomer,
  handleGetCustomer,
  handleGetCustomerServiceHistory,
  handleListCustomers,
  handleUpdateCustomer,
} from '../controllers/customer.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken, requireRole('OWNER'));
router.post('/', handleCreateCustomer);
router.get('/', handleListCustomers);
router.get('/:id/history', handleGetCustomerServiceHistory);
router.get('/:id', handleGetCustomer);
router.patch('/:id', handleUpdateCustomer);

export default router;
