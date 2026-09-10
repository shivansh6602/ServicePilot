import * as customerService from '../services/customer.service.js';
import {
  createCustomerSchema,
  customerIdSchema,
  customerSearchSchema,
  updateCustomerSchema,
} from '../validators/customer.validator.js';

const validationError = (res, result) => res.status(400).json({
  status: 'fail',
  message: 'Validation failed',
  errors: result.error.flatten().fieldErrors,
});

const handleError = (res, error) => res.status(error.statusCode || 500).json({
  status: error.statusCode ? 'fail' : 'error',
  message: error.message || 'Internal server error',
});

export const handleCreateCustomer = async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const customer = await customerService.createCustomer(req.user.businessId, parsed.data);
    return res.status(201).json({ status: 'success', data: { customer } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleListCustomers = async (req, res) => {
  const parsed = customerSearchSchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const customers = await customerService.listCustomers(
      req.user.businessId,
      parsed.data.search || parsed.data.q,
    );
    return res.status(200).json({ status: 'success', data: { customers } });
  } catch (error) {
    return handleError(res, error);
  }
};

const parseCustomerId = (req, res) => {
  const parsed = customerIdSchema.safeParse(req.params);
  if (!parsed.success) {
    validationError(res, parsed);
    return null;
  }
  return parsed.data.id;
};

export const handleGetCustomer = async (req, res) => {
  const customerId = parseCustomerId(req, res);
  if (!customerId) return undefined;
  try {
    const customer = await customerService.getCustomer(req.user.businessId, customerId);
    return res.status(200).json({ status: 'success', data: { customer } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleGetCustomerServiceHistory = async (req, res) => {
  const customerId = parseCustomerId(req, res);
  if (!customerId) return undefined;
  try {
    const jobs = await customerService.getCustomerServiceHistory(req.user.businessId, customerId);
    return res.status(200).json({ status: 'success', data: { jobs } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const handleUpdateCustomer = async (req, res) => {
  const customerId = parseCustomerId(req, res);
  if (!customerId) return undefined;
  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);
  try {
    const customer = await customerService.updateCustomer(req.user.businessId, customerId, parsed.data);
    return res.status(200).json({ status: 'success', data: { customer } });
  } catch (error) {
    return handleError(res, error);
  }
};
