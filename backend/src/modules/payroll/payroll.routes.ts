import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
  assertSelfOrAdmin,
} from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { runPayrollSchema, publishPayrollSchema } from "@dayflow/shared";

import { runPayroll, publishPayroll, getPayslips } from "./payroll.service.js";

export const payrollRoutes = Router();

// All payroll routes require auth + password changed
payrollRoutes.use(requireAuth, requirePasswordChanged);

// ---------------------------------------------------------------------------
// POST /run — Generate DRAFT payslips
// ---------------------------------------------------------------------------

payrollRoutes.post(
  "/run",
  requireRole("ADMIN"),
  validate(runPayrollSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year } = req.body;
      const result = await runPayroll(req.user!.companyId, req.user!.sub, month, year);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /publish — Flip to PUBLISHED and generate PDFs
// ---------------------------------------------------------------------------

payrollRoutes.post(
  "/publish",
  requireRole("ADMIN"),
  validate(publishPayrollSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year, force } = req.body;
      const result = await publishPayroll(req.user!.companyId, req.user!.sub, month, year, force);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /payslips/:employeeId — List published payslips
// ---------------------------------------------------------------------------

payrollRoutes.get(
  "/payslips/:employeeId",
  assertSelfOrAdmin((req) => req.params.employeeId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payslips = await getPayslips(req.params.employeeId!, req.user!.companyId);
      res.json({ data: payslips });
    } catch (err) {
      next(err);
    }
  },
);
