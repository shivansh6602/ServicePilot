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

const completionText = (field) => z.string({ required_error: `${field} is required` })
  .trim()
  .min(1, `${field} is required`)
  .max(4000, `${field} must be at most 4000 characters`);

const optionalCompletionText = z.string()
  .trim()
  .max(4000, 'Notes must be at most 4000 characters')
  .optional();

const jobPartSchema = z.object({
  name: z.string({ required_error: 'Part name is required' }).trim().min(1).max(255),
  quantity: z.coerce.number().int().min(1).max(100000),
  unitCost: z.coerce.number().finite().min(0),
}).strict();

const jobChargeSchema = z.object({
  title: z.string({ required_error: 'Charge title is required' }).trim().min(1).max(255),
  amount: z.coerce.number().finite().min(0),
}).strict();

const jobPhotoSchema = z.object({
  type: z.enum(['BEFORE', 'AFTER'], { required_error: 'Photo type is required' }),
  photoUrl: z.string({ required_error: 'Photo URL is required' }).url('Photo URL must be a valid URL').max(2048),
  caption: z.string().trim().max(1000).optional(),
}).strict();

export const completeJobSchema = z.object({
  problemFound: completionText('Problem found'),
  workPerformed: completionText('Work performed'),
  workNotes: optionalCompletionText,
  completionNotes: optionalCompletionText,
  parts: z.array(jobPartSchema).max(100).default([]),
  charges: z.array(jobChargeSchema).max(100).default([]),
  photos: z.array(jobPhotoSchema).max(20).default([]),
}).strict();
