import { Router } from 'express';
import { handleRegisterTenant, handleLogin } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @route   POST /api/auth/register-tenant
 * @desc    Register a new Business Tenant along with its primary OWNER account
 * @access  Public
 */
router.post('/register-tenant', handleRegisterTenant);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate User credentials & return signed JWT token
 * @access  Public
 */
router.post('/login', handleLogin);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve context of currently authenticated User & Business Tenant
 * @access  Private (Requires valid JWT)
 */
router.get('/me', authenticateToken, (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

export default router;
