import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

const technicianSelect = {
  id: true,
  businessId: true,
  email: true,
  name: true,
  role: true,
  profilePhotoUrl: true,
  createdAt: true,
  updatedAt: true,
};

const duplicateEmailError = () => {
  const error = new Error('An account with this email address already exists');
  error.statusCode = 409;
  return error;
};

const notFoundError = () => {
  const error = new Error('Technician not found');
  error.statusCode = 404;
  return error;
};

export const createTechnician = async (businessId, { name, email, password }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw duplicateEmailError();

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    return await prisma.user.create({
      data: {
        businessId,
        name,
        email,
        passwordHash,
        role: 'TECHNICIAN',
      },
      select: technicianSelect,
    });
  } catch (error) {
    if (error.code === 'P2002') throw duplicateEmailError();
    throw error;
  }
};

export const listTechnicians = (businessId) => prisma.user.findMany({
  where: {
    businessId,
    role: 'TECHNICIAN',
  },
  select: technicianSelect,
  orderBy: { createdAt: 'desc' },
});

export const getTechnician = async (businessId, technicianId) => {
  const technician = await prisma.user.findFirst({
    where: { id: technicianId, businessId, role: 'TECHNICIAN' },
    select: technicianSelect,
  });
  if (!technician) throw notFoundError();
  return technician;
};

export const updateTechnician = async (businessId, technicianId, data) => {
  try {
    const result = await prisma.user.updateMany({
      where: { id: technicianId, businessId, role: 'TECHNICIAN' },
      data,
    });
    if (result.count === 0) throw notFoundError();
  } catch (error) {
    if (error.code === 'P2002') throw duplicateEmailError();
    throw error;
  }

  return getTechnician(businessId, technicianId);
};

export const updateTechnicianProfilePhoto = async (businessId, technicianId, profilePhotoUrl) => {
  const result = await prisma.user.updateMany({
    where: { id: technicianId, businessId, role: 'TECHNICIAN' },
    data: { profilePhotoUrl },
  });
  if (result.count === 0) throw notFoundError();
  return getTechnician(businessId, technicianId);
};
