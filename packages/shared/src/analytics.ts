import { z } from "zod";

export const analyticsOverviewQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  departmentId: z.string().cuid().optional(),
});
export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;

export const statWithDeltaSchema = z.object({
  value: z.number(),
  deltaPercent: z.number().nullable(),
});
export type StatWithDelta = z.infer<typeof statWithDeltaSchema>;

export const analyticsOverviewResponseSchema = z.object({
  stats: z.object({
    attendanceRate: statWithDeltaSchema,
    averageWorkHours: statWithDeltaSchema,
    totalExtraHours: statWithDeltaSchema,
    totalTimeOffDays: statWithDeltaSchema,
    totalPayrollCost: statWithDeltaSchema,
  }),
  attendanceRateByDay: z.array(z.object({ date: z.string(), rate: z.number() })),
  timeOffByType: z.array(z.object({ type: z.string(), days: z.number() })),
  headcountByDepartment: z.array(z.object({ department: z.string(), count: z.number() })),
  payrollCostByMonth: z.array(z.object({ month: z.string(), cost: z.number() })),
  averageCheckInTimeByDay: z.array(
    z.object({ date: z.string(), minutesAfterMidnight: z.number() }),
  ),
});
export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>;
