import prisma from "../config/prisma.js";

const error = (message, statusCode) =>
  Object.assign(new Error(message), {
    statusCode,
  });
const notFoundError = () =>
  error("Job not found", 404);
const conflictError = (message) =>
  error(message, 409);
const roundCurrency = (value) =>
  Number((value + Number.EPSILON).toFixed(2));

const paymentSelect = {
  id: true,
  amount: true,
  paymentMethod: true,
  notes: true,
  createdAt: true,
};

const receiptJobSelect = {
  id: true,
  businessId: true,
  status: true,
  serviceCharge: true,
  discount: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
    },
  },
  parts: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unitCost: true,
      createdAt: true,
    },
  },
  charges: {
    select: {
      id: true,
      title: true,
      amount: true,
      createdAt: true,
    },
  },
  payments: {
    select: paymentSelect,
    orderBy: { createdAt: "asc" },
  },
};

export const calculateFinancials = (job) => {
  const partsTotal = roundCurrency(
    job.parts.reduce(
      (sum, part) =>
        sum + part.quantity * part.unitCost,
      0,
    ),
  );
  const chargesTotal = roundCurrency(
    job.charges.reduce(
      (sum, charge) => sum + charge.amount,
      0,
    ),
  );
  const subtotal = roundCurrency(
    job.serviceCharge + partsTotal + chargesTotal,
  );
  const total = Math.max(
    0,
    roundCurrency(subtotal - job.discount),
  );
  const paid = roundCurrency(
    job.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    ),
  );
  const pending = Math.max(
    0,
    roundCurrency(total - paid),
  );
  const paymentStatus =
    pending === 0
      ? "PAID"
      : paid === 0
        ? "UNPAID"
        : "PARTIALLY_PAID";

  return {
    partsTotal,
    chargesTotal,
    subtotal,
    discount: job.discount,
    total,
    paid,
    pending,
    paymentStatus,
  };
};

const buildReceipt = (job) => ({
  job: {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
  },
  customer: job.customer,
  serviceCharge: job.serviceCharge,
  discount: job.discount,
  parts: job.parts.map((part) => ({
    ...part,
    total: roundCurrency(
      part.quantity * part.unitCost,
    ),
  })),
  charges: job.charges,
  payments: job.payments,
  totals: calculateFinancials(job),
});

export const getReceipt = async (
  businessId,
  jobId,
) => {
  const job = await prisma.job.findFirst({
    where: { id: jobId, businessId },
    select: receiptJobSelect,
  });
  if (!job) throw notFoundError();
  return buildReceipt(job);
};

export const recordPayment = async (
  businessId,
  actorId,
  jobId,
  data,
) =>

  
  prisma.$transaction(async (tx) => {
    // Serialise payments for this job, so two concurrent requests cannot both spend the same pending balance.
    //Think of Job 123 as having a tiny "payment processing" lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${jobId}))`;
    const job = await tx.job.findFirst({
      where: { id: jobId, businessId },
      select: receiptJobSelect,
    });
    if (!job) throw notFoundError();
    if (job.status !== "COMPLETED") {
      throw conflictError(
        "Payments may only be recorded for completed jobs",
      );
    }

    const financials = calculateFinancials(job);
    if (data.amount > financials.pending) {
      throw conflictError(
        "Payment amount exceeds the pending amount",
      );
    }

    const payment = await tx.payment.create({
      data: {
        jobId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      },
      select: paymentSelect,
    });

    const paidAfterPayment = roundCurrency(
      financials.paid + data.amount,
    );
    if (paidAfterPayment === financials.total) {
      const result = await tx.job.updateMany({
        where: {
          id: jobId,
          businessId,
          status: "COMPLETED",
        },
        data: { status: "PAID" },
      });
      if (result.count === 0)
        throw conflictError(
          "Job was modified by another request",
        );
      await tx.jobStatusHistory.create({
        data: {
          jobId,
          fromStatus: "COMPLETED",
          toStatus: "PAID",
          changedById: actorId,
        },
      });
    }

    const savedJob = await tx.job.findFirst({
      where: { id: jobId, businessId },
      select: receiptJobSelect,
    });
    return {
      payment,
      receipt: buildReceipt(savedJob),
    };
  });
