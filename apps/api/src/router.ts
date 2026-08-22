// apps/api/src/router.ts — M1 ONLY. Do not edit; your module file is already mounted.
// See docs/Dayflow-Team-Plan.md §3.2. Each import resolves to a stub Router that
// its owner fills in — nobody edits this file again once their route exists.
import { Router } from "express";

import { healthRoutes } from "@/modules/health/health.routes.js";
import { authRoutes } from "@/modules/auth/auth.routes.js";
import { companyRoutes } from "@/modules/company/company.routes.js";
import { settingsRoutes } from "@/modules/settings/settings.routes.js";
import { notificationRoutes } from "@/modules/notifications/notifications.routes.js";
import { streamRoutes } from "@/modules/notifications/stream.routes.js";
import { auditRoutes } from "@/modules/audit/audit.routes.js";
import { employeeRoutes } from "@/modules/employees/employees.routes.js";
import { profileRoutes } from "@/modules/profile/profile.routes.js";
import { contractRoutes } from "@/modules/contracts/contracts.routes.js";
import { payrollRoutes } from "@/modules/payroll/payroll.routes.js";
import { attendanceRoutes } from "@/modules/attendance/attendance.routes.js";
import { timeOffRoutes } from "@/modules/timeoff/timeoff.routes.js";
import { analyticsRoutes } from "@/modules/analytics/analytics.routes.js";

export const router = Router();

router.use("/health", healthRoutes); // M1
router.use("/auth", authRoutes); // M1
router.use("/company", companyRoutes); // M1
router.use("/settings", settingsRoutes); // M1
router.use("/notifications", notificationRoutes); // M1
router.use("/stream", streamRoutes); // M1 — SSE, added in Step 17
router.use("/audit", auditRoutes); // M1
router.use("/employees", employeeRoutes); // M3
router.use("/profile", profileRoutes); // M3
router.use("/contracts", contractRoutes); // M3
router.use("/payroll", payrollRoutes); // M3
router.use("/attendance", attendanceRoutes); // M4
router.use("/time-off", timeOffRoutes); // M4
router.use("/analytics", analyticsRoutes); // M4
