import { z } from 'zod';

const optionalText = (field, maxLength) => z
  .string({ invalid_type_error: `${field} must be a string` })
  .trim()
  .max(maxLength, `${field} must be at most ${maxLength} characters`)
  .optional();

const customerFields = {
  name: z
    .string({ required_error: 'Customer name is required' })
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name must be at most 100 characters'),
  phone: z
    .string({ required_error: 'Customer phone number is required' })
    .trim()
    .min(7, 'Customer phone number must be at least 7 characters')
    .max(20, 'Customer phone number must be at most 20 characters')
    .regex(/^[+()\-\s0-9]+$/, 'Customer phone number contains invalid characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .optional()
    .or(z.literal('')),
  address: optionalText('Customer address', 500),
  notes: optionalText('Customer notes', 2000),
};

export const createCustomerSchema = z.object(customerFields);

export const updateCustomerSchema = z.object({
  ...customerFields,
  name: customerFields.name.optional(),
  phone: customerFields.phone.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one customer field must be provided',
});

export const customerIdSchema = z.object({
  id: z.string().uuid('Invalid customer ID'),
});

export const customerSearchSchema = z.object({
  search: z.string().trim().min(1, 'Search term cannot be empty').max(100).optional(),
  q: z.string().trim().min(1, 'Search term cannot be empty').max(100).optional(),
}).refine((data) => !(data.search && data.q), {
  message: 'Use either search or q, not both',
});
