import * as technicianService from '../services/technician.service.js';
import {
  createTechnicianSchema,
  technicianIdSchema,
  technicianProfilePhotoSchema,
  updateTechnicianSchema,
} from '../validators/technician.validator.js';

const validationError = (res, result) => res.status(400).json({
  status: 'fail',
  message: 'Validation failed',
  errors: result.error.flatten().fieldErrors,
});

const handleError = (res, error) => res.status(error.statusCode || 500).json({
  status: error.statusCode ? 'fail' : 'error',
  message: error.message || 'Internal server error',
});

export const handleCreateTechnician = async (req, res) => {
  const parsed = createTechnicianSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  try {
    const technician = await technicianService.createTechnician(req.user.businessId, parsed.data);
    return res.status(201).json({ status: 'success', data: { technician } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleListTechnicians = async (req, res) => {
  try {
    const technicians = await technicianService.listTechnicians(req.user.businessId);
    return res.status(200).json({ status: 'success', data: { technicians } });
  } catch (error) {
    return handleError(res, error);
  }
};

const parseTechnicianId = (req, res) => {
  const parsed = technicianIdSchema.safeParse(req.params);
  if (!parsed.success) {
    validationError(res, parsed);
    return null;
  }
  return parsed.data.id;
};

export const handleGetTechnician = async (req, res) => {
  const technicianId = parseTechnicianId(req, res);
  if (!technicianId) return undefined;
  try {
    const technician = await technicianService.getTechnician(req.user.businessId, technicianId);
    return res.status(200).json({ status: 'success', data: { technician } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleUpdateTechnician = async (req, res) => {
  const technicianId = parseTechnicianId(req, res);
  if (!technicianId) return undefined;
  const parsed = updateTechnicianSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const technician = await technicianService.updateTechnician(
      req.user.businessId,
      technicianId,
      parsed.data,
    );
    return res.status(200).json({ status: 'success', data: { technician } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleUpdateTechnicianProfilePhoto = async (req, res) => {
  const technicianId = parseTechnicianId(req, res);
  if (!technicianId) return undefined;
  const parsed = technicianProfilePhotoSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  // Owners may manage any technician in their tenant; technicians may only manage themselves.
  if (req.user.role !== 'OWNER' && req.user.userId !== technicianId) {
    return res.status(403).json({ status: 'fail', message: 'Forbidden. Technicians may only update their own profile photo' });
  }

  try {
    const technician = await technicianService.updateTechnicianProfilePhoto(
      req.user.businessId,
      technicianId,
      parsed.data.profilePhotoUrl,
    );
    return res.status(200).json({ status: 'success', data: { technician } });
  } catch (error) {
    return handleError(res, error);
  }
};
