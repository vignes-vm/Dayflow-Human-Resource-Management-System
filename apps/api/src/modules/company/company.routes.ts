import { Router } from "express";
import { z } from "zod";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";

export const companyRoutes = Router();

companyRoutes.use(requireAuth, requirePasswordChanged);

const companyUpdateSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    logoUrl: z.string().url().optional(),
    address: z.string().max(300).optional(),
    timezone: z.string().min(1).optional(),
    code: z
      .string()
      .length(2)
      .regex(/^[A-Za-z]{2}$/, "Company code must be two letters")
      .transform((v) => v.toUpperCase())
      .optional(),
    serialWidth: z.number().int().min(3).max(6).optional(),
    workDaysPerWeek: z.number().int().min(1).max(7).optional(),
    standardDailyHours: z.number().int().min(1).max(24).optional(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    pfRateEmployee: z.number().min(0).max(100).optional(),
    pfRateEmployer: z.number().min(0).max(100).optional(),
    professionalTax: z.number().min(0).optional(),
    coverageOkThreshold: z.number().int().min(0).max(100).optional(),
    coverageRiskThreshold: z.number().int().min(0).max(100).optional(),
    absenceCutoffHour: z.number().int().min(0).max(23).optional(),
  })
  .strict();

companyRoutes.get("/", async (req, res, next) => {
  try {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });
    res.json(company);
  } catch (err) {
    next(err);
  }
});

companyRoutes.patch(
  "/",
  requireRole("ADMIN"),
  validate(companyUpdateSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });
      const after = await prisma.company.update({ where: { id: before.id }, data: req.body });

      await writeAudit({
        companyId: before.id,
        actorId: req.user!.sub,
        action: "COMPANY_SETTINGS_UPDATED",
        entity: "Company",
        entityId: before.id,
        before,
        after,
      });

      res.json(after);
    } catch (err) {
      next(err);
    }
  },
);
