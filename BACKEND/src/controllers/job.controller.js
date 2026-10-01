import * as jobService from '../services/job.service.js';
import * as paymentService from '../services/payment.service.js';
import {
  assignTechnicianSchema, completeJobSchema, createJobSchema, jobIdSchema, updateJobStatusSchema,
} from '../validators/job.validator.js';
import { paymentSchema } from '../validators/payment.validator.js';

const validationError = (res, result) => res.status(400).json({
  status: 'fail', message: 'Validation failed', errors: result.error.flatten().fieldErrors,
});
const handleError = (res, err) => res.status(err.statusCode || 500).json({
  status: err.statusCode ? 'fail' : 'error', message: err.message || 'Internal server error',
});
const parseJobId = (req, res) => {
  const parsed = jobIdSchema.safeParse(req.params);
  if (!parsed.success) { validationError(res, parsed); return null; }
  return parsed.data.id;
};

export const handleCreateJob = async (req, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const job = await jobService.createJob(req.user.businessId, parsed.data);
    return res.status(201).json({ status: 'success', data: { job } });
  } catch (err) { return handleError(res, err); }
};

export const handleAssignTechnician = async (req, res) => {
  const jobId = parseJobId(req, res); if (!jobId) return undefined;
  const parsed = assignTechnicianSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const job = await jobService.assignTechnician(req.user.businessId, req.user.userId, jobId, parsed.data.technicianId);
    return res.status(200).json({ status: 'success', data: { job } });
  } catch (err) { return handleError(res, err); }
};

export const handleUpdateJobStatus = async (req, res) => {
  const jobId = parseJobId(req, res); if (!jobId) return undefined;
  const parsed = updateJobStatusSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const job = await jobService.updateJobStatus(req.user.businessId, req.user, jobId, parsed.data.status);
    return res.status(200).json({ status: 'success', data: { job } });
  } catch (err) { return handleError(res, err); }
};

export const handleCompleteJob = async (req, res) => {
  const jobId = parseJobId(req, res); if (!jobId) return undefined;
  const parsed = completeJobSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const job = await jobService.completeJob(req.user.businessId, req.user, jobId, parsed.data);
    return res.status(200).json({ status: 'success', data: { job } });
  } catch (err) { return handleError(res, err); }
};

export const handleRecordPayment = async (req, res) => {
  const jobId = parseJobId(req, res); if (!jobId) return undefined;
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const result = await paymentService.recordPayment(req.user.businessId, req.user.userId, jobId, parsed.data);
    return res.status(201).json({ status: 'success', data: result });
  } catch (err) { return handleError(res, err); }
};

export const handleGetReceipt = async (req, res) => {
  const jobId = parseJobId(req, res); if (!jobId) return undefined;
  try {
    const receipt = await paymentService.getReceipt(req.user.businessId, jobId);
    return res.status(200).json({ status: 'success', data: { receipt } });
  } catch (err) { return handleError(res, err); }
};
