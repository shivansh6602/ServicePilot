import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

/**
 * Service function to register a new Business tenant along with its initial OWNER user.
 * Executes within an atomic database transaction.
 */
export const registerTenant = async ({ businessName, name, email, password }) => {
  // 1. Check if user email is already registered in the database
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error('An account with this email address already exists');
    error.statusCode = 409; // Conflict
    throw error;
  }

  // 2. Hash owner password with bcrypt (cost factor = 10)
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 3. Execute atomic transaction to create Business and initial OWNER User
  const { business, user } = await prisma.$transaction(async (tx) => {
    // Step A: Create the Business record
    const createdBusiness = await tx.business.create({
      data: {
        name: businessName,
      },
    });

    // Step B: Create the primary OWNER User linked to the new Business
    const createdUser = await tx.user.create({
      data: {
        businessId: createdBusiness.id,
        email,
        passwordHash,
        name,
        role: 'OWNER',
      },
    });

    return { business: createdBusiness, user: createdUser };
  });

  // 4. Generate JWT payload containing user context and tenant identity
  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  };

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  const token = jwt.sign(payload, secret, { expiresIn });

  // 5. Exclude passwordHash from the returned user object
  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    business,
    token,
  };
};

/**
 * Service function to authenticate a user with email & password.
 */
export const login = async ({ email, password }) => {
  // 1. Find user by email, including business tenant information
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401; // Unauthorized
    throw error;
  }

  // 2. Verify password hash using bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401; // Unauthorized
    throw error;
  }

  // 3. Generate signed JWT token
  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  };

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  const token = jwt.sign(payload, secret, { expiresIn });

  // 4. Exclude passwordHash from returned payload
  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    token,
  };
};
