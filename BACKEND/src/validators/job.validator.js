import { z } from 'zod';

const jobStatusValues = [
  'REQUESTED', 'ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS',
  'COMPLETED', 'CONFIRMED', 'PAID', 'CANCELLED',
];

export const jobIdSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
});

export const createJobSchema = z.object({
  customerId: z.string({ required_error: 'Customer ID is required' }).uuid('Invalid customer ID'),
  problemDescription: z
    .string({ required_error: 'Problem description is required' })
    .trim()
    .min(2, 'Problem description must be at least 2 characters')
    .max(2000, 'Problem description must be at most 2000 characters'),
  scheduledAt: z.coerce.date('Invalid scheduled date').optional(),
  serviceCharge: z.coerce.number().finite().min(0, 'Service charge cannot be negative').optional(),
  discount: z.coerce.number().finite().min(0, 'Discount cannot be negative').optional(),
}).strict();

export const assignTechnicianSchema = z.object({
  technicianId: z.string({ required_error: 'Technician ID is required' }).uuid('Invalid technician ID'),
}).strict();

export const updateJobStatusSchema = z.object({
  status: z.enum(jobStatusValues, { required_error: 'Job status is required' }),
}).strict();
