
import { validateCustomerAccessToken } from '../services/customer-access.service.js';

export const requireCustomerAccess = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string'
    ? authHeader.match(/^Bearer\s+(\S+)$/i)
    : null;

  if (!match) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired customer access link',
    });
  }

  try {
    const access = await validateCustomerAccessToken(match[1]);

    if (!access) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired customer access link',
      });
    }

    req.customerAccess = access;
    return next();
  } catch (error) {
    return next(error);
  }
};
