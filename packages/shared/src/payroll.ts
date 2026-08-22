import { z } from "zod";

// ---------------------------------------------------------------------------
// Salary Component
// ---------------------------------------------------------------------------

const componentComputationEnum = z.enum(["FIXED", "PCT_OF_WAGE", "PCT_OF_COMPONENT", "BALANCE"]);
const componentCategoryEnum = z.enum(["EARNING", "EMPLOYEE_DEDUCTION", "EMPLOYER_CONTRIBUTION"]);

export const salaryComponentInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Must be UPPER_SNAKE_CASE"),
  label: z.string().min(1).max(150),
  category: componentCategoryEnum,
  computation: componentComputationEnum,
  value: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Must be a numeric string with up to 4 decimal places"),
  baseComponentCode: z.string().max(50).optional().nullable(),
});
export type SalaryComponentInput = z.infer<typeof salaryComponentInputSchema>;

// ---------------------------------------------------------------------------
// Contract input schemas
// ---------------------------------------------------------------------------

export const contractPreviewSchema = z.object({
  employeeId: z.string().cuid(),
  monthlyWage: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid monetary amount"),
  components: z.array(salaryComponentInputSchema).min(1),
  effectiveFrom: z.coerce.date(),
});
export type ContractPreviewInput = z.infer<typeof contractPreviewSchema>;

export const createContractSchema = contractPreviewSchema;
export type CreateContractInput = z.infer<typeof createContractSchema>;

// ---------------------------------------------------------------------------
// Contract response DTOs
// ---------------------------------------------------------------------------

export const computedLineSchema = z.object({
  code: z.string(),
  label: z.string(),
  category: componentCategoryEnum,
  computation: componentComputationEnum,
  amount: z.string(), // serialised Decimal as string
});
export type ComputedLineDto = z.infer<typeof computedLineSchema>;

export const contractPreviewResponseSchema = z.object({
  lines: z.array(computedLineSchema),
  totals: z.object({
    grossEarnings: z.string(),
    totalEmployeeDeductions: z.string(),
    totalEmployerContributions: z.string(),
    netPay: z.string(),
  }),
  errors: z.array(
    z.object({
      type: z.string(),
      message: z.string(),
    }),
  ),
});
export type ContractPreviewResponse = z.infer<typeof contractPreviewResponseSchema>;

export const contractSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  effectiveFrom: z.coerce.date(),
  monthlyWage: z.string(),
  components: z.array(computedLineSchema),
  createdAt: z.coerce.date(),
  createdBy: z.object({ id: z.string(), firstName: z.string(), lastName: z.string() }).nullable(),
});
export type ContractDto = z.infer<typeof contractSchema>;

// ---------------------------------------------------------------------------
// Payroll run
// ---------------------------------------------------------------------------

export const runPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;

export const publishPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  force: z.boolean().default(false),
});
export type PublishPayrollInput = z.infer<typeof publishPayrollSchema>;

// ---------------------------------------------------------------------------
// Payslip DTOs
// ---------------------------------------------------------------------------

export const payslipStatusEnum = z.enum(["DRAFT", "PUBLISHED"]);

export const payslipLineSchema = z.object({
  code: z.string(),
  label: z.string(),
  category: componentCategoryEnum,
  amount: z.string(), // serialised Decimal
});
export type PayslipLineDto = z.infer<typeof payslipLineSchema>;

export const payslipAnomalySchema = z.object({
  type: z.enum(["NO_CONTRACT", "ZERO_PAYABLE_DAYS", "NET_NOT_POSITIVE", "HIGH_LOP"]),
  employeeId: z.string(),
  employeeName: z.string(),
  message: z.string(),
});
export type PayslipAnomaly = z.infer<typeof payslipAnomalySchema>;

export const payslipDraftRowSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  loginId: z.string(),
  totalWorkingDays: z.number(),
  payableDays: z.string(),
  unpaidLeaveDays: z.string(),
  missingAttendanceDays: z.string(),
  lossOfPay: z.string(),
  grossEarnings: z.string(),
  totalDeductions: z.string(),
  netPay: z.string(),
  anomalies: z.array(payslipAnomalySchema),
  status: payslipStatusEnum,
});
export type PayslipDraftRow = z.infer<typeof payslipDraftRowSchema>;

export const payslipDetailSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  month: z.number(),
  year: z.number(),
  status: payslipStatusEnum,
  payableDays: z.string(),
  totalWorkingDays: z.number(),
  grossEarnings: z.string(),
  totalDeductions: z.string(),
  netPay: z.string(),
  lossOfPay: z.string(),
  pdfUrl: z.string().nullable(),
  lines: z.array(payslipLineSchema),
  publishedAt: z.coerce.date().nullable(),
});
export type PayslipDetail = z.infer<typeof payslipDetailSchema>;

export const payslipSummarySchema = z.object({
  id: z.string(),
  month: z.number(),
  year: z.number(),
  status: payslipStatusEnum,
  netPay: z.string(),
  pdfUrl: z.string().nullable(),
});
export type PayslipSummary = z.infer<typeof payslipSummarySchema>;
