import { z } from "zod";

const attendanceStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEKEND",
]);
const attendanceSourceEnum = z.enum(["SELF", "ADMIN", "SYSTEM"]);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const attendanceSessionSchema = z.object({
  id: z.string(),
  inAt: z.coerce.date(),
  outAt: z.coerce.date().nullable(),
});
export type AttendanceSessionDto = z.infer<typeof attendanceSessionSchema>;

// ---------------------------------------------------------------------------
// Attendance record (day-wise, "my attendance")
// ---------------------------------------------------------------------------

export const attendanceRecordSchema = z.object({
  id: z.string(),
  date: z.coerce.date(),
  status: attendanceStatusEnum,
  firstCheckIn: z.coerce.date().nullable(),
  lastCheckOut: z.coerce.date().nullable(),
  workMinutes: z.number(),
  breakMinutes: z.number(),
  extraMinutes: z.number(),
  source: attendanceSourceEnum,
  note: z.string().nullable(),
  editedById: z.string().nullable(),
  editedAt: z.coerce.date().nullable(),
  sessions: z.array(attendanceSessionSchema),
});
export type AttendanceRecordDto = z.infer<typeof attendanceRecordSchema>;

export const attendanceMeQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type AttendanceMeQuery = z.infer<typeof attendanceMeQuerySchema>;

// ---------------------------------------------------------------------------
// Admin day view — every employee for one date
// ---------------------------------------------------------------------------

export const attendanceDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentId: z.string().cuid().optional(),
});
export type AttendanceDayQuery = z.infer<typeof attendanceDayQuerySchema>;

export const attendanceDayRowSchema = z.object({
  recordId: z.string().nullable(),
  employeeId: z.string(),
  employeeName: z.string(),
  loginId: z.string(),
  department: z.string().nullable(),
  status: attendanceStatusEnum,
  firstCheckIn: z.coerce.date().nullable(),
  lastCheckOut: z.coerce.date().nullable(),
  workMinutes: z.number(),
  extraMinutes: z.number(),
});
export type AttendanceDayRow = z.infer<typeof attendanceDayRowSchema>;

// ---------------------------------------------------------------------------
// Regularisation (ADMIN/HR)
// ---------------------------------------------------------------------------

export const regularizeAttendanceSchema = z.object({
  status: attendanceStatusEnum.optional(),
  firstCheckIn: z.coerce.date().optional().nullable(),
  lastCheckOut: z.coerce.date().optional().nullable(),
  reason: z.string().min(1).max(500),
});
export type RegularizeAttendanceInput = z.infer<typeof regularizeAttendanceSchema>;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export const attendanceSummarySchema = z.object({
  daysPresent: z.number(),
  leavesCount: z.number(),
  totalWorkingDays: z.number(),
  totalHours: z.number(),
  totalExtraHours: z.number(),
});
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>;

export const attendanceSummaryQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;

// ---------------------------------------------------------------------------
// Presence (live)
// ---------------------------------------------------------------------------

export const presenceEntrySchema = z.object({
  employeeId: z.string(),
  presence: z.enum(["GREEN", "AIRPLANE", "YELLOW", "RED"]),
});
export type PresenceEntry = z.infer<typeof presenceEntrySchema>;
