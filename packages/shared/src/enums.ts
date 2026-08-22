/**
 * Every enum in the Prisma schema, transcribed once. Written by M1 in Step 1/2;
 * not touched again once the barrel is wired — see docs/Dayflow-Team-Plan.md §3.5.
 */

export const Role = {
  ADMIN: "ADMIN",
  HR: "HR",
  EMPLOYEE: "EMPLOYEE",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const EmployeeStatus = {
  ACTIVE: "ACTIVE",
  EXITED: "EXITED",
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const AttendanceStatus = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  HALF_DAY: "HALF_DAY",
  ON_LEAVE: "ON_LEAVE",
  HOLIDAY: "HOLIDAY",
  WEEKEND: "WEEKEND",
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AttendanceSource = {
  SELF: "SELF",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
} as const;
export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

export const PresenceState = {
  GREEN: "GREEN",
  AIRPLANE: "AIRPLANE",
  YELLOW: "YELLOW",
  RED: "RED",
} as const;
export type PresenceState = (typeof PresenceState)[keyof typeof PresenceState];

export const TimeOffTypeCode = {
  PAID: "PAID",
  SICK: "SICK",
  UNPAID: "UNPAID",
} as const;
export type TimeOffTypeCode = (typeof TimeOffTypeCode)[keyof typeof TimeOffTypeCode];

export const AllocationStatus = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  REFUSED: "REFUSED",
} as const;
export type AllocationStatus = (typeof AllocationStatus)[keyof typeof AllocationStatus];

export const HalfDay = {
  NONE: "NONE",
  FIRST_HALF: "FIRST_HALF",
  SECOND_HALF: "SECOND_HALF",
} as const;
export type HalfDay = (typeof HalfDay)[keyof typeof HalfDay];

export const TimeOffRequestStatus = {
  TO_APPROVE: "TO_APPROVE",
  APPROVED: "APPROVED",
  REFUSED: "REFUSED",
  CANCELLED: "CANCELLED",
} as const;
export type TimeOffRequestStatus = (typeof TimeOffRequestStatus)[keyof typeof TimeOffRequestStatus];

export const WageType = {
  FIXED: "FIXED",
} as const;
export type WageType = (typeof WageType)[keyof typeof WageType];

export const ContractStatus = {
  DRAFT: "DRAFT",
  RUNNING: "RUNNING",
  EXPIRED: "EXPIRED",
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const ComponentCategory = {
  EARNING: "EARNING",
  EMPLOYEE_DEDUCTION: "EMPLOYEE_DEDUCTION",
  EMPLOYER_CONTRIBUTION: "EMPLOYER_CONTRIBUTION",
} as const;
export type ComponentCategory = (typeof ComponentCategory)[keyof typeof ComponentCategory];

export const ComponentComputation = {
  FIXED: "FIXED",
  PCT_OF_WAGE: "PCT_OF_WAGE",
  PCT_OF_COMPONENT: "PCT_OF_COMPONENT",
  BALANCE: "BALANCE",
} as const;
export type ComponentComputation = (typeof ComponentComputation)[keyof typeof ComponentComputation];

export const PayslipStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;
export type PayslipStatus = (typeof PayslipStatus)[keyof typeof PayslipStatus];
