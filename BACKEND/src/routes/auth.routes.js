import { Router } from 'express';
import {
  handleRegister,
  handleRegisterTenant,
  handleLogin,
  handleRefresh,
  handleLogout,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint for tenant registration
router.post('/register', handleRegister);
router.post('/register-tenant', handleRegisterTenant);

// Endpoint for user login
router.post('/login', handleLogin);

// Endpoint for refreshing short-lived access token using httpOnly refresh cookie
router.post('/refresh', handleRefresh);

// Endpoint for clearing refresh cookie
router.post('/logout', handleLogout);

// Protected endpoint to verify active session
router.get('/me', authenticateToken, (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

export default router;
