import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import {
  attendanceDayQuerySchema,
  attendanceMeQuerySchema,
  attendanceSummaryQuerySchema,
  regularizeAttendanceSchema,
} from "@dayflow/shared";

import {
  checkIn,
  checkOut,
  getMyToday,
  getMyAttendance,
  getDayView,
  regularizeAttendance,
  getSummary,
} from "./attendance.service.js";

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth, requirePasswordChanged);

attendanceRoutes.post("/check-in", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.employeeId) throw new Error("No employee record for this user");
    const result = await checkIn(req.user!.companyId, req.user!.employeeId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

attendanceRoutes.post("/check-out", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.employeeId) throw new Error("No employee record for this user");
    const result = await checkOut(req.user!.companyId, req.user!.employeeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

attendanceRoutes.get("/me/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.employeeId) throw new Error("No employee record for this user");
    const result = await getMyToday(req.user!.companyId, req.user!.employeeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

attendanceRoutes.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = attendanceMeQuerySchema.parse(req.query);
    if (!req.user!.employeeId) throw new Error("No employee record for this user");
    const records = await getMyAttendance(req.user!.companyId, req.user!.employeeId, query.month);
    res.json({ data: records });
  } catch (err) {
    next(err);
  }
});

attendanceRoutes.get(
  "/day",
  requireRole("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = attendanceDayQuerySchema.parse(req.query);
      const rows = await getDayView(req.user!.companyId, query.date, query.departmentId);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

attendanceRoutes.patch(
  "/:id",
  requireRole("ADMIN", "HR"),
  validate(regularizeAttendanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await regularizeAttendance(
        req.params.id!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

attendanceRoutes.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = attendanceSummaryQuerySchema.parse(req.query);
    const targetEmployeeId = query.employeeId ?? req.user!.employeeId;
    if (!targetEmployeeId) throw new Error("No employee record for this user");

    const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "HR";
    if (!isPrivileged && targetEmployeeId !== req.user!.employeeId) {
      res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "You don't have access to this" } });
      return;
    }

    const summary = await getSummary(req.user!.companyId, targetEmployeeId, query.month);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
