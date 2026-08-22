import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { analyticsOverviewQuerySchema } from "@dayflow/shared";

import { getOverview } from "./analytics.service.js";

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth, requirePasswordChanged, requireRole("ADMIN", "HR"));

analyticsRoutes.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = analyticsOverviewQuerySchema.parse(req.query);
    const overview = await getOverview(req.user!.companyId, query);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});
