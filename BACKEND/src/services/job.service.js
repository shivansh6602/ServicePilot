import prisma from '../config/prisma.js';

// CONFIRMED and PAID are intentionally left to later workflow phases.
export const allowedTransitions = Object.freeze({
  REQUESTED: ['ASSIGNED'],
  ASSIGNED: ['ON_THE_WAY'],
  ON_THE_WAY: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CONFIRMED: [],
  PAID: [],
  CANCELLED: [],
});

const jobSelect = {
  id: true, businessId: true, customerId: true, technicianId: true, status: true,
  problemDescription: true, scheduledAt: true, serviceCharge: true, discount: true,
  createdAt: true, updatedAt: true,
};

const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const notFoundError = () => error('Job not found', 404);
const conflictError = (message) => error(message, 409);

export const createJob = async (businessId, data) => {
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId }, select: { id: true },
  });
  if (!customer) throw error('Customer not found', 404);

  return prisma.job.create({
    data: { ...data, businessId },
    select: jobSelect,
  });
};

export const assignTechnician = async (businessId, actorId, jobId, technicianId) => {
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, businessId, role: 'TECHNICIAN' }, select: { id: true },
  });
  if (!technician) throw error('Technician not found', 404);

  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: jobId, businessId }, select: { id: true, status: true },
    });
    if (!job) throw notFoundError();
    if (job.status !== 'REQUESTED') {
      throw conflictError('Only requested jobs can be assigned');
    }

    // The status predicate prevents a concurrent assignment from overwriting this one.
    const result = await tx.job.updateMany({
      where: { id: jobId, businessId, status: 'REQUESTED' },
      data: { technicianId, status: 'ASSIGNED' },
    });
    if (result.count === 0) throw conflictError('Job was modified by another request');

    await tx.jobStatusHistory.create({
      data: { jobId, fromStatus: 'REQUESTED', toStatus: 'ASSIGNED', changedById: actorId },
    });
    return tx.job.findFirst({ where: { id: jobId, businessId }, select: jobSelect });
  });
};

export const updateJobStatus = async (businessId, actor, jobId, nextStatus) => prisma.$transaction(async (tx) => {
  const job = await tx.job.findFirst({
    where: { id: jobId, businessId },
    select: { id: true, status: true, technicianId: true },
  });
  if (!job) throw notFoundError();
  if (actor.role === 'TECHNICIAN' && job.technicianId !== actor.userId) {
    throw error('Forbidden. Technicians may only operate on their assigned jobs', 403);
  }
  if (!allowedTransitions[job.status]?.includes(nextStatus)) {
    throw conflictError(`Invalid job status transition from ${job.status} to ${nextStatus}`);
  }

  // Compare-and-set closes the read/validate/update race without trusting client state.
  const result = await tx.job.updateMany({
    where: { id: jobId, businessId, status: job.status },
    data: { status: nextStatus },
  });
  if (result.count === 0) throw conflictError('Job was modified by another request');

  await tx.jobStatusHistory.create({
    data: { jobId, fromStatus: job.status, toStatus: nextStatus, changedById: actor.userId },
  });
  return tx.job.findFirst({ where: { id: jobId, businessId }, select: jobSelect });
});
