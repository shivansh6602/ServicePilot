
import { createHash, randomBytes } from 'node:crypto';
import prisma from '../config/prisma.js';

const ACCESS_TOKEN_DAYS = 7;

const createError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const hashToken = (token) =>
  createHash('sha256').update(token).digest('hex');


export const issueCustomerAccessToken = async (businessId, jobId) => {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + ACCESS_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: jobId, businessId },
      select: { id: true },
    });

    if (!job) {
      throw createError('Job not found', 404);
    }
   
    await tx.customerAccessToken.updateMany({
      where: { jobId: job.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.customerAccessToken.create({
      data: {
        tokenHash,
        jobId: job.id,
        expiresAt,
      },
    });
  });

 
  return { token, expiresAt };
};


export const validateCustomerAccessToken = async (token) => {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  const tokenHash = hashToken(token);

  const storedToken = await prisma.customerAccessToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      jobId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!storedToken) return null;
  if (storedToken.revokedAt) return null;
  if (storedToken.expiresAt.getTime() <= Date.now()) return null;

  // Expose only the minimum context needed by protected handlers.
  return {
    tokenId: storedToken.id,
    jobId: storedToken.jobId,
  };
};

export const revokeCustomerAccessTokens = async (jobId) => {
  const result = await prisma.customerAccessToken.updateMany({
    where: {
      jobId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count;
};
