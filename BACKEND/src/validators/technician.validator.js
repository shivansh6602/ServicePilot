import { z } from 'zod';

export const createTechnicianSchema = z.object({
  name: z
    .string({ required_error: 'Technician full name is required' })
    .trim()
    .min(2, 'Technician name must be at least 2 characters')
    .max(100, 'Technician name must be at most 100 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long'),
});

const updateFields = {
  name: z
    .string({ invalid_type_error: 'Technician full name must be a string' })
    .trim()
    .min(2, 'Technician name must be at least 2 characters')
    .max(100, 'Technician name must be at most 100 characters')
    .optional(),
  email: z
    .string({ invalid_type_error: 'Email address must be a string' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .optional(),
};

// Password changes have a dedicated flow when introduced; this endpoint never accepts raw passwords.
export const updateTechnicianSchema = z.object(updateFields).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one technician field must be provided' },
);

export const technicianIdSchema = z.object({
  id: z.string().uuid('Invalid technician ID'),
});

export const technicianProfilePhotoSchema = z.object({
  profilePhotoUrl: z
    .string({ required_error: 'Profile photo URL is required' })
    .trim()
    .url('Invalid URL format for profile photo'),
}).strict();
