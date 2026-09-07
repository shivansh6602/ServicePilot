import * as authService from '../services/auth.service.js';
import { registerTenantSchema, loginSchema } from '../validators/auth.validator.js';


const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});


export const handleRegister = async (req, res) => {
  try {
    const validationResult = registerTenantSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const result = await authService.registerTenant(validationResult.data);

    res.cookie('refreshToken', result.refreshToken, getCookieOptions());

    return res.status(201).json({
      status: 'success',
      message: 'Business tenant and owner account created successfully',
      data: {
        user: result.user,
        business: result.business,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Internal server error during registration',
    });
  }
};


export const handleRegisterTenant = handleRegister;


export const handleLogin = async (req, res) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const result = await authService.login(validationResult.data);

    res.cookie('refreshToken', result.refreshToken, getCookieOptions());

    return res.status(200).json({
      status: 'success',
      message: 'Authentication successful',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Internal server error during login',
    });
  }
};


export const handleRefresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'fail',
        message: 'Refresh token cookie is missing',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      status: 'success',
      message: 'Access token refreshed successfully',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Failed to refresh access token',
    });
  }
};


export const handleLogout = async (req, res) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error during logout',
    });
  }
};
