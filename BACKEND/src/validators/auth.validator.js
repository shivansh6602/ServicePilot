import { z } from 'zod';


export const registerTenantSchema = z.object({
  businessName: z
    .string({ required_error: 'Business name is required' })
    .trim()
    .min(2, 'Business name must be at least 2 characters'),
  name: z
    .string({ required_error: 'Owner full name is required' })
    .trim()
    .min(2, 'Owner name must be at least 2 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long'),
  profilePhotoUrl: z
    .string()
    .trim()
    .url('Invalid URL format for profile photo')
    .optional()
    .or(z.literal('')),
});


export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});
