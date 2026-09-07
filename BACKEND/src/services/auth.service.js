import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';


export const generateAccessToken = (payload) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret, { expiresIn });
};

export const generateRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
};


export const registerTenant = async ({ businessName, name, email, password, profilePhotoUrl }) => {

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error('An account with this email address already exists');
    error.statusCode = 409;
    throw error;
  }


  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);


  const { business, user } = await prisma.$transaction(async (tx) => {

    const createdBusiness = await tx.business.create({
      data: {
        name: businessName,
      },
    });


    const createdUser = await tx.user.create({
      data: {
        businessId: createdBusiness.id,
        email,
        passwordHash,
        name,
        role: 'OWNER',
        profilePhotoUrl: profilePhotoUrl || null,
      },
    });

    return { business: createdBusiness, user: createdUser };
  });


  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    business,
    accessToken,
    refreshToken,
  };
};


export const login = async ({ email, password }) => {

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
    error.statusCode = 401;
    throw error;
  }


  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }


  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken,
  };
};


export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 401;
    throw error;
  }

  const payload = {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  };

  const newAccessToken = generateAccessToken(payload);
  const { passwordHash: _, ...safeUser } = user;

  return {
    accessToken: newAccessToken,
    user: safeUser,
  };
};
