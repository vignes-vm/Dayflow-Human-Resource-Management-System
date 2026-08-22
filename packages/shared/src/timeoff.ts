import { z } from "zod";

const timeOffTypeCodeEnum = z.enum(["PAID", "SICK", "UNPAID"]);
const halfDayEnum = z.enum(["NONE", "FIRST_HALF", "SECOND_HALF"]);
const allocationStatusEnum = z.enum(["DRAFT", "APPROVED", "REFUSED"]);
const requestStatusEnum = z.enum(["TO_APPROVE", "APPROVED", "REFUSED", "CANCELLED"]);

// ---------------------------------------------------------------------------
// Time off types
// ---------------------------------------------------------------------------

export const timeOffTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: timeOffTypeCodeEnum,
  isPaid: z.boolean(),
  requiresAttachment: z.boolean(),
  colorToken: z.string().nullable(),
  defaultAllocationDays: z.string(),
});
export type TimeOffTypeDto = z.infer<typeof timeOffTypeSchema>;

export const createTimeOffTypeSchema = z.object({
  name: z.string().min(1).max(100),
  code: timeOffTypeCodeEnum,
  isPaid: z.boolean().default(true),
  requiresAttachment: z.boolean().default(false),
  colorToken: z.string().max(50).optional().nullable(),
  defaultAllocationDays: z
    .string()
    .regex(/^\d+(\.\d)?$/, "Must be a numeric string with up to 1 decimal place"),
});
export type CreateTimeOffTypeInput = z.infer<typeof createTimeOffTypeSchema>;

export const updateTimeOffTypeSchema = createTimeOffTypeSchema.partial();
export type UpdateTimeOffTypeInput = z.infer<typeof updateTimeOffTypeSchema>;

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

export const createAllocationSchema = z.object({
  employeeIds: z.array(z.string().cuid()).min(1),
  typeId: z.string().cuid(),
  days: z.string().regex(/^\d+(\.\d)?$/, "Must be a numeric string with up to 1 decimal place"),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;

export const updateAllocationSchema = z.object({
  days: z
    .string()
    .regex(/^\d+(\.\d)?$/)
    .optional(),
  validTo: z.coerce.date().optional().nullable(),
  status: allocationStatusEnum.optional(),
  note: z.string().max(500).optional().nullable(),
});
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;

export const allocationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  typeId: z.string(),
  typeName: z.string(),
  days: z.string(),
  used: z.string(),
  remaining: z.string(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().nullable(),
  status: allocationStatusEnum,
  note: z.string().nullable(),
});
export type AllocationDto = z.infer<typeof allocationSchema>;

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export const timeOffBalanceSchema = z.object({
  typeId: z.string(),
  typeName: z.string(),
  code: timeOffTypeCodeEnum,
  colorToken: z.string().nullable(),
  allocated: z.string(),
  used: z.string(),
  pending: z.string(),
  remaining: z.string(),
});
export type TimeOffBalance = z.infer<typeof timeOffBalanceSchema>;

// ---------------------------------------------------------------------------
// Request preview
// ---------------------------------------------------------------------------

export const timeOffRequestPreviewSchema = z.object({
  employeeId: z.string().cuid().optional(),
  typeId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  halfDay: halfDayEnum.default("NONE"),
});
export type TimeOffRequestPreviewInput = z.infer<typeof timeOffRequestPreviewSchema>;

export const excludedDateSchema = z.object({
  date: z.string(),
  reason: z.string(),
});
export type ExcludedDateDto = z.infer<typeof excludedDateSchema>;

export const timeOffRequestPreviewResponseSchema = z.object({
  workingDays: z.number(),
  excludedDates: z.array(excludedDateSchema),
  balanceRemaining: z.string().nullable(),
  balanceAfter: z.string().nullable(),
  warnings: z.array(z.string()),
  error: z.string().nullable(),
});
export type TimeOffRequestPreviewResponse = z.infer<typeof timeOffRequestPreviewResponseSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const createTimeOffRequestSchema = z.object({
  typeId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  halfDay: halfDayEnum.default("NONE"),
  reason: z.string().max(1000).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
});
export type CreateTimeOffRequestInput = z.infer<typeof createTimeOffRequestSchema>;

export const timeOffRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  typeId: z.string(),
  typeName: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  halfDay: halfDayEnum,
  days: z.string(),
  reason: z.string().nullable(),
  attachmentUrl: z.string().nullable(),
  status: requestStatusEnum,
  decidedById: z.string().nullable(),
  decidedAt: z.coerce.date().nullable(),
  decisionComment: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type TimeOffRequestDto = z.infer<typeof timeOffRequestSchema>;

export const listTimeOffRequestsQuerySchema = z.object({
  status: requestStatusEnum.optional(),
  employeeId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListTimeOffRequestsQuery = z.infer<typeof listTimeOffRequestsQuerySchema>;

export const decideTimeOffRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REFUSED"]),
  comment: z.string().max(1000).optional().nullable(),
});
export type DecideTimeOffRequestInput = z.infer<typeof decideTimeOffRequestSchema>;

// ---------------------------------------------------------------------------
// Calendar (year grid)
// ---------------------------------------------------------------------------

export const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarDaySchema = z.object({
  date: z.string(),
  typeCode: timeOffTypeCodeEnum,
  colorToken: z.string().nullable(),
  status: requestStatusEnum,
  requestId: z.string(),
});
export type CalendarDay = z.infer<typeof calendarDaySchema>;

// ---------------------------------------------------------------------------
// Coverage Radar (impact) — Dayflow-Blueprint-v2.md §3.1
// ---------------------------------------------------------------------------

export const coverageDaySchema = z.object({
  date: z.string(),
  headcount: z.number(),
  away: z.number(),
  coverage: z.number(),
  level: z.enum(["ok", "watch", "risk"]),
});
export type CoverageDay = z.infer<typeof coverageDaySchema>;

export const collisionSchema = z.object({
  employeeId: z.string(),
  employee: z.string(),
  designation: z.string().nullable(),
  dates: z.string(),
  status: requestStatusEnum,
});
export type CollisionDto = z.infer<typeof collisionSchema>;

export const timeOffFlagEnum = z.enum([
  "SECOND_REQUEST_THIS_MONTH",
  "CROSSES_MONTH_END",
  "SHORT_NOTICE",
  "NO_CERTIFICATE_ATTACHED",
  "ADJACENT_TO_HOLIDAY",
]);
export type TimeOffFlag = z.infer<typeof timeOffFlagEnum>;

export const timeOffImpactResponseSchema = z.object({
  allocationAfter: z
    .object({
      type: z.string(),
      allocated: z.string(),
      used: z.string(),
      thisRequest: z.string(),
      remaining: z.string(),
    })
    .nullable(),
  workingDays: z.number(),
  excludedDates: z.array(excludedDateSchema),
  teamCoverage: z.array(coverageDaySchema),
  collisions: z.array(collisionSchema),
  flags: z.array(timeOffFlagEnum),
});
export type TimeOffImpactResponse = z.infer<typeof timeOffImpactResponseSchema>;

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

export const holidaySchema = z.object({
  id: z.string(),
  date: z.coerce.date(),
  name: z.string(),
});
export type HolidayDto = z.infer<typeof holidaySchema>;
