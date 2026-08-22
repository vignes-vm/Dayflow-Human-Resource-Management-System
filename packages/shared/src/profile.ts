import { z } from "zod";

// ---------------------------------------------------------------------------
// Profile / Resume
// ---------------------------------------------------------------------------

export const selfUpdateProfileSchema = z.object({
  phone: z.string().min(6).max(20).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  // Resume fields
  about: z.string().max(2000).optional().nullable(),
  lovesAboutJob: z.string().max(2000).optional().nullable(),
  hobbies: z.string().max(2000).optional().nullable(),
});
export type SelfUpdateProfileInput = z.infer<typeof selfUpdateProfileSchema>;

// ---------------------------------------------------------------------------
// Skills & Certifications
// ---------------------------------------------------------------------------

export const addSkillSchema = z.object({
  name: z.string().min(1).max(100),
});
export type AddSkillInput = z.infer<typeof addSkillSchema>;

export const addCertificationSchema = z.object({
  name: z.string().min(1).max(150),
  issuer: z.string().max(150).optional().nullable(),
  issuedOn: z.coerce.date().optional().nullable(),
  expiresOn: z.coerce.date().optional().nullable(),
  url: z.string().url().optional().nullable(),
});
export type AddCertificationInput = z.infer<typeof addCertificationSchema>;

// ---------------------------------------------------------------------------
// Private Info
// The API stores only the last 4 digits of Aadhaar. Never send or store the full number.
// ---------------------------------------------------------------------------

export const updatePrivateInfoSchema = z.object({
  dateOfBirth: z.coerce.date().optional().nullable(),
  nationality: z.string().max(60).optional().nullable(),
  personalEmail: z.string().email().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().nullable(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional().nullable(),
  // Bank details
  bankAccountNumber: z.string().max(30).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  ifscCode: z.string().max(20).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  uanNumber: z.string().max(20).optional().nullable(),
  employeeCode: z.string().max(30).optional().nullable(),
  // Aadhaar — accept full input but the service stores only last 4 digits
  aadhaarLast4: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional()
    .nullable(),
});
export type UpdatePrivateInfoInput = z.infer<typeof updatePrivateInfoSchema>;

// ---------------------------------------------------------------------------
// Private Info response DTO
// ---------------------------------------------------------------------------

export const privateInfoResponseSchema = z.object({
  id: z.string(),
  dateOfBirth: z.coerce.date().nullable(),
  nationality: z.string().nullable(),
  personalEmail: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).nullable(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).nullable(),
  bankAccountNumber: z.string().nullable(), // masked by default — last 4 visible
  bankName: z.string().nullable(),
  ifscCode: z.string().nullable(),
  panNumber: z.string().nullable(),
  uanNumber: z.string().nullable(),
  employeeCode: z.string().nullable(),
  aadhaarLast4: z.string().nullable(),
});
export type PrivateInfoResponse = z.infer<typeof privateInfoResponseSchema>;

// ---------------------------------------------------------------------------
// Resume response DTO
// ---------------------------------------------------------------------------

export const resumeResponseSchema = z.object({
  id: z.string(),
  about: z.string().nullable(),
  lovesAboutJob: z.string().nullable(),
  hobbies: z.string().nullable(),
  skills: z.array(z.object({ id: z.string(), name: z.string() })),
  certifications: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      issuer: z.string().nullable(),
      issuedOn: z.coerce.date().nullable(),
      expiresOn: z.coerce.date().nullable(),
      url: z.string().nullable(),
    }),
  ),
});
export type ResumeResponse = z.infer<typeof resumeResponseSchema>;

// ---------------------------------------------------------------------------
// Security / sessions
// Note: changePasswordSchema and ChangePasswordInput are exported from auth.ts
// ---------------------------------------------------------------------------
