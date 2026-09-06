import * as authService from '../services/auth.service.js';
import { registerTenantSchema, loginSchema } from '../validators/auth.validator.js';

/**
 * HTTP Controller for Business Tenant Registration
 * POST /api/auth/register-tenant
 */
export const handleRegisterTenant = async (req, res) => {
  try {
    // 1. Validate request body against Zod schema
    const validationResult = registerTenantSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    // 2. Delegate to Auth Service
    const result = await authService.registerTenant(validationResult.data);

    // 3. Return HTTP 201 Created response
    return res.status(201).json({
      status: 'success',
      message: 'Business tenant and owner account created successfully',
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Internal server error during registration',
    });
  }
};

/**
 * HTTP Controller for User Login
 * POST /api/auth/login
 */
export const handleLogin = async (req, res) => {
  try {
    // 1. Validate request body against Zod schema
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    // 2. Delegate to Auth Service
    const result = await authService.login(validationResult.data);

    // 3. Return HTTP 200 OK response
    return res.status(200).json({
      status: 'success',
      message: 'Authentication successful',
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Internal server error during login',
    });
  }
};
