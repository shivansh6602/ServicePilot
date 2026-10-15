
import { Router } from 'express';
import { requireCustomerAccess } from '../middleware/customer-access.middleware.js';
import { handleGetCustomerJob } from '../controllers/customer-access.controller.js';

const router = Router();

router.get('/job', requireCustomerAccess, handleGetCustomerJob);

export default router;
