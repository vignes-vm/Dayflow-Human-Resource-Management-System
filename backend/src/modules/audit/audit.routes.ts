import { Router } from "express";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { prisma } from "@/lib/prisma.js";

export const auditRoutes = Router();

auditRoutes.use(requireAuth, requirePasswordChanged, requireRole("ADMIN"));

auditRoutes.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));

    const where = {
      companyId: req.user!.companyId,
      ...(req.query.entity ? { entity: String(req.query.entity) } : {}),
      ...(req.query.actorId ? { actorId: String(req.query.actorId) } : {}),
      ...(req.query.from || req.query.to
        ? {
            createdAt: {
              ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
              ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, loginId: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
});
