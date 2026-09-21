import { Router } from 'express';
import {
  handleCreateTechnician,
  handleGetTechnician,
  handleListTechnicians,
  handleUpdateTechnician,
  handleUpdateTechnicianProfilePhoto,
} from '../controllers/technician.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js';

const router = Router();


router.use(authenticateToken);
router.post('/', requireRole('OWNER'), handleCreateTechnician);
router.get('/', requireRole('OWNER'), handleListTechnicians);
router.get('/:id', requireRole('OWNER'), handleGetTechnician);
router.patch('/:id', requireRole('OWNER'), handleUpdateTechnician);
router.patch('/:id/profile-photo', requireRole('OWNER', 'TECHNICIAN'), handleUpdateTechnicianProfilePhoto);

export default router;
