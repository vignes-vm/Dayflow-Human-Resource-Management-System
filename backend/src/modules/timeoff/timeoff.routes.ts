import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import {
  calendarQuerySchema,
  createAllocationSchema,
  createTimeOffRequestSchema,
  createTimeOffTypeSchema,
  decideTimeOffRequestSchema,
  listTimeOffRequestsQuerySchema,
  timeOffRequestPreviewSchema,
  updateAllocationSchema,
  updateTimeOffTypeSchema,
} from "@dayflow/shared";

import {
  listTypes,
  createType,
  updateType,
  listAllocations,
  createAllocation,
  updateAllocation,
  getBalances,
  previewRequest,
  createRequest,
  listRequests,
  decideRequest,
  cancelRequest,
  getCalendar,
} from "./timeoff.service.js";
import { computeImpact } from "./coverage.service.js";

export const timeOffRoutes = Router();

timeOffRoutes.use(requireAuth, requirePasswordChanged);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

timeOffRoutes.get("/types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await listTypes(req.user!.companyId);
    res.json({ data: types });
  } catch (err) {
    next(err);
  }
});

timeOffRoutes.post(
  "/types",
  requireRole("ADMIN"),
  validate(createTimeOffTypeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = await createType(req.user!.companyId, req.user!.sub, req.body);
      res.status(201).json(type);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.patch(
  "/types/:id",
  requireRole("ADMIN"),
  validate(updateTimeOffTypeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = await updateType(req.params.id!, req.user!.companyId, req.user!.sub, req.body);
      res.json(type);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

timeOffRoutes.get("/allocations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "HR";
    const employeeId = (req.query.employeeId as string | undefined) ?? undefined;
    if (!isPrivileged && employeeId && employeeId !== req.user!.employeeId) {
      res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "You don't have access to this" } });
      return;
    }
    const target = isPrivileged ? employeeId : (req.user!.employeeId ?? undefined);
    const allocations = await listAllocations(req.user!.companyId, target);
    res.json({ data: allocations });
  } catch (err) {
    next(err);
  }
});

timeOffRoutes.post(
  "/allocations",
  requireRole("ADMIN", "HR"),
  validate(createAllocationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createAllocation(req.user!.companyId, req.user!.sub, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.patch(
  "/allocations/:id",
  requireRole("ADMIN", "HR"),
  validate(updateAllocationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await updateAllocation(
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

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

timeOffRoutes.get("/balances", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "HR";
    const employeeId = (req.query.employeeId as string | undefined) ?? req.user!.employeeId;
    if (!employeeId) throw new Error("No employee record for this user");
    if (!isPrivileged && employeeId !== req.user!.employeeId) {
      res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "You don't have access to this" } });
      return;
    }
    const balances = await getBalances(req.user!.companyId, employeeId);
    res.json({ data: balances });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

timeOffRoutes.post(
  "/requests/preview",
  validate(timeOffRequestPreviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user!.employeeId) throw new Error("No employee record for this user");
      const result = await previewRequest(req.user!.companyId, req.user!.employeeId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.post(
  "/requests",
  validate(createTimeOffRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user!.employeeId) throw new Error("No employee record for this user");
      const result = await createRequest(req.user!.companyId, req.user!.employeeId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.get("/requests", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listTimeOffRequestsQuerySchema.parse(req.query);
    const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "HR";
    const employeeId = isPrivileged ? query.employeeId : (req.user!.employeeId ?? undefined);
    const requests = await listRequests(req.user!.companyId, { ...query, employeeId });
    res.json({ data: requests });
  } catch (err) {
    next(err);
  }
});

timeOffRoutes.get("/requests/calendar", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = calendarQuerySchema.parse(req.query);
    if (!req.user!.employeeId) throw new Error("No employee record for this user");
    const days = await getCalendar(req.user!.companyId, req.user!.employeeId, query.year);
    res.json({ data: days });
  } catch (err) {
    next(err);
  }
});

timeOffRoutes.get(
  "/:id/impact",
  requireRole("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const impact = await computeImpact(req.params.id!, req.user!.companyId);
      res.json(impact);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.post(
  "/:id/decide",
  requireRole("ADMIN", "HR"),
  validate(decideTimeOffRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await decideRequest(
        req.params.id!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

timeOffRoutes.post("/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "HR";
    const result = await cancelRequest(
      req.params.id!,
      req.user!.companyId,
      req.user!.sub,
      req.user!.employeeId,
      isPrivileged,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
