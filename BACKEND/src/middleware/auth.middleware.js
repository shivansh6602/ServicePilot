import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware: Verifies JWT signature and injects authenticated user context
 * (req.user = { userId, businessId, role }) into the request pipeline.
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      message: 'Access denied. Missing or malformed authorization token',
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secret);
    
    // Attach cryptographically verified user & tenant payload to request
    req.user = {
      userId: decoded.userId,
      businessId: decoded.businessId,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Authorization token has expired. Please log in again',
      });
    }

    return res.status(401).json({
      status: 'fail',
      message: 'Invalid authorization token',
    });
  }
};

/**
 * Authorization Middleware: Enforces Role-Based Access Control (RBAC).
 * @param {...string} allowedRoles - List of roles permitted to access the route (e.g. 'OWNER')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: `Forbidden. Action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
    return next();
  };
};
