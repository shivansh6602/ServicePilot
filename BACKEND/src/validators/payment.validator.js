import { z } from 'zod';

export const paymentSchema = z.object({
  amount: z.coerce.number().finite().positive('Payment amount must be greater than zero').multipleOf(0.01, 'Payment amount may have at most two decimal places'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER'], {
    required_error: 'Payment method is required',
  }),
  notes: z.string().trim().max(2000, 'Notes must be at most 2000 characters').optional(),
}).strict();

export const idempotencyKeySchema = z.string()
  .trim()
  .min(1, 'Idempotency-Key header is required')
  .max(255, 'Idempotency-Key header must be at most 255 characters');
