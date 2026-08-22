import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
  assertSelfOrAdmin,
} from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { ApiError } from "@/middleware/errorHandler.js";
import {
  createEmployeeSchema,
  adminUpdateEmployeeSchema,
  listEmployeesQuerySchema,
  createDepartmentSchema,
  updateDepartmentSchema,
} from "@dayflow/shared";

import {
  listEmployees,
  getEmployee,
  createEmployee,
  adminUpdateEmployee,
  listDepartments,
  createDepartment,
  updateDepartment,
} from "./employees.service.js";

export const employeeRoutes = Router();

// All employee routes require auth + password changed
employeeRoutes.use(requireAuth, requirePasswordChanged);

// ---------------------------------------------------------------------------
// GET /employees — list (all roles)
// ---------------------------------------------------------------------------

employeeRoutes.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listEmployeesQuerySchema.parse(req.query);
    const result = await listEmployees(req.user!.companyId, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /employees — create (ADMIN / HR)
// ---------------------------------------------------------------------------

employeeRoutes.post(
  "/",
  requireRole("ADMIN", "HR"),
  validate(createEmployeeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createEmployee(req.user!.companyId, req.user!.sub, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /employees/:id — single employee (role-shaped)
// ---------------------------------------------------------------------------

employeeRoutes.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emp = await getEmployee(
      req.params.id!,
      req.user!.companyId,
      req.user!.role,
      req.user!.employeeId,
    );
    res.json(emp);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /employees/:id — admin update
// ---------------------------------------------------------------------------

employeeRoutes.patch(
  "/:id",
  requireRole("ADMIN", "HR"),
  validate(adminUpdateEmployeeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await adminUpdateEmployee(req.params.id!, req.user!.companyId, req.user!.sub, req.body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

employeeRoutes.get("/departments/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const depts = await listDepartments(req.user!.companyId);
    res.json({ data: depts });
  } catch (err) {
    next(err);
  }
});

employeeRoutes.post(
  "/departments",
  requireRole("ADMIN"),
  validate(createDepartmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await createDepartment(req.user!.companyId, req.user!.sub, req.body);
      res.status(201).json(dept);
    } catch (err) {
      next(err);
    }
  },
);

employeeRoutes.patch(
  "/departments/:id",
  requireRole("ADMIN"),
  validate(updateDepartmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await updateDepartment(
        req.params.id!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.json(dept);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /employees/presence — batch presence for polling / SSE refresh
// ---------------------------------------------------------------------------

employeeRoutes.get("/presence/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Lightweight endpoint — returns just {employeeId, presence} pairs
    const query = listEmployeesQuerySchema.parse({ ...req.query, pageSize: 100 });
    const result = await listEmployees(req.user!.companyId, query);
    res.json({
      data: result.data.map((e) => ({ id: e.id, presence: e.presence })),
    });
  } catch (err) {
    next(err);
  }
});
