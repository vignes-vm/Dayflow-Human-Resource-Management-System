import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (re-used from enums.ts via the barrel, but we reference the literals here)
// ---------------------------------------------------------------------------

const roleEnum = z.enum(["ADMIN", "HR", "EMPLOYEE"]);
const employeeStatusEnum = z.enum(["ACTIVE", "EXITED"]);
const presenceStateEnum = z.enum(["GREEN", "AIRPLANE", "YELLOW", "RED"]);
const workLocationEnum = z.enum(["OFFICE", "REMOTE", "HYBRID"]);

// ---------------------------------------------------------------------------
// Create Employee
// ---------------------------------------------------------------------------

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(0).max(80).default(""),
  email: z.string().email(),
  phone: z.string().min(6).max(20).optional(),
  departmentId: z.string().cuid().optional().nullable(),
  jobTitle: z.string().min(1).max(120),
  managerId: z.string().cuid().optional().nullable(),
  joinedOn: z.coerce.date(),
  role: roleEnum.default("EMPLOYEE"),
  workLocation: workLocationEnum.default("OFFICE"),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ---------------------------------------------------------------------------
// Update Employee (admin)
// ---------------------------------------------------------------------------

export const adminUpdateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().max(80).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(20).optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  jobTitle: z.string().min(1).max(120).optional(),
  managerId: z.string().cuid().optional().nullable(),
  workLocation: workLocationEnum.optional(),
  role: roleEnum.optional(),
  status: employeeStatusEnum.optional(),
});
export type AdminUpdateEmployeeInput = z.infer<typeof adminUpdateEmployeeSchema>;

// ---------------------------------------------------------------------------
// Update Employee (self — restricted subset)
// ---------------------------------------------------------------------------

export const selfUpdateEmployeeSchema = z.object({
  phone: z.string().min(6).max(20).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});
export type SelfUpdateEmployeeInput = z.infer<typeof selfUpdateEmployeeSchema>;

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  /** Must be an Employee id — maps to Department.headEmployeeId in the schema */
  headEmployeeId: z.string().cuid().optional().nullable(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

/** Minimal card payload for the employee grid */
export const employeeCardSchema = z.object({
  id: z.string(),
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
  jobTitle: z.string().nullable(),
  department: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  presence: presenceStateEnum,
});
export type EmployeeCard = z.infer<typeof employeeCardSchema>;

/** Full employee detail — shape depends on viewer role */
export const employeeDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  loginId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  workLocation: workLocationEnum.nullable(),
  role: roleEnum,
  status: employeeStatusEnum,
  joinedOn: z.coerce.date(),
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  manager: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
});
export type EmployeeDetail = z.infer<typeof employeeDetailSchema>;

/** Payload returned exactly once when an employee is created */
export const newEmployeeCredentialsSchema = z.object({
  loginId: z.string(),
  temporaryPassword: z.string(),
  email: z.string().email(),
  emailPreviewUrl: z.string().url().optional(),
});
export type NewEmployeeCredentials = z.infer<typeof newEmployeeCredentialsSchema>;

/** Department DTO */
export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  head: z.object({ id: z.string(), firstName: z.string(), lastName: z.string() }).nullable(),
  employeeCount: z.number().int().optional(),
});
export type Department = z.infer<typeof departmentSchema>;

// ---------------------------------------------------------------------------
// List query params
// ---------------------------------------------------------------------------

export const listEmployeesQuerySchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().cuid().optional(),
  presence: presenceStateEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
