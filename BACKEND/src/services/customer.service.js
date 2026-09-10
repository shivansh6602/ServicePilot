import prisma from '../config/prisma.js';

const customerSelect = {
  id: true,
  businessId: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

const notFoundError = () => {
  const error = new Error('Customer not found');
  error.statusCode = 404;
  return error;
};

const normalizeOptionalFields = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, value === '' ? null : value]),
);

export const createCustomer = async (businessId, data) => {
  try {
    return await prisma.customer.create({
      data: { ...normalizeOptionalFields(data), businessId },
      select: customerSelect,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const conflict = new Error('A customer with this phone number already exists');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
};

export const listCustomers = (businessId, search) => prisma.customer.findMany({
  where: {
    businessId,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  },
  select: customerSelect,
  orderBy: { createdAt: 'desc' },
});

export const getCustomer = async (businessId, customerId) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: {
      ...customerSelect,
      jobs: {
        where: { businessId },
        select: {
          id: true,
          status: true,
          problemDescription: true,
          scheduledAt: true,
          serviceCharge: true,
          discount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) throw notFoundError();
  return customer;
};

export const getCustomerServiceHistory = async (businessId, customerId) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, jobs: {
      where: { businessId },
      select: {
        id: true,
        status: true,
        problemDescription: true,
        scheduledAt: true,
        serviceCharge: true,
        discount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    } },
  });

  if (!customer) throw notFoundError();
  return customer.jobs;
};

export const updateCustomer = async (businessId, customerId, data) => {
  let result;
  try {
    result = await prisma.customer.updateMany({
      where: { id: customerId, businessId },
      data: normalizeOptionalFields(data),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const conflict = new Error('A customer with this phone number already exists');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }

  if (result.count === 0) throw notFoundError();

  return prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: customerSelect,
  });
};
