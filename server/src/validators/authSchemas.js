const { z } = require('zod');

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  semester: z.enum(['3', '5']).transform(Number),
  classSection: z.enum(['X1', 'X2', 'Y1', 'Y2']),
  password: z.string().min(12).max(128),
}).strict();
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
const profileUpdateSchema = z.object({ name: z.string().trim().min(2).max(100) }).strict();
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict();
const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(12).max(128),
}).strict();

module.exports = { registerSchema, loginSchema, profileUpdateSchema, passwordChangeSchema, forgotPasswordSchema, resetPasswordSchema };
