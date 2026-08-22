import { Router } from "express";
import { z } from "zod";

import { requireAuth, requirePasswordChanged, requireRole } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { prisma, scopedPrisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { buildLoginId } from "@/engines/loginId.js";

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth, requirePasswordChanged);

const holidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1).max(120),
});

const bulkImportSchema = z.object({
  holidays: z.array(holidaySchema).min(1).max(100),
});

settingsRoutes.get("/holidays", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const holidays = await scopedPrisma(req.user!.companyId).holiday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
      orderBy: { date: "asc" },
    });
    res.json({ items: holidays });
  } catch (err) {
    next(err);
  }
});

settingsRoutes.post(
  "/holidays",
  requireRole("ADMIN"),
  validate(holidaySchema),
  async (req, res, next) => {
    try {
      const holiday = await prisma.holiday.create({
        data: { companyId: req.user!.companyId, date: req.body.date, name: req.body.name },
      });
      await writeAudit({
        companyId: req.user!.companyId,
        actorId: req.user!.sub,
        action: "HOLIDAY_CREATED",
        entity: "Holiday",
        entityId: holiday.id,
        after: holiday,
      });
      res.status(201).json(holiday);
    } catch (err) {
      next(err);
    }
  },
);

settingsRoutes.post(
  "/holidays/bulk-import",
  requireRole("ADMIN"),
  validate(bulkImportSchema),
  async (req, res, next) => {
    try {
      const companyId = req.user!.companyId;
      const result = await prisma.holiday.createMany({
        data: req.body.holidays.map((h: { date: Date; name: string }) => ({
          companyId,
          date: h.date,
          name: h.name,
        })),
        skipDuplicates: true,
      });

      await writeAudit({
        companyId,
        actorId: req.user!.sub,
        action: "HOLIDAYS_BULK_IMPORTED",
        entity: "Holiday",
        entityId: companyId,
        after: { count: result.count },
      });

      res.status(201).json({ imported: result.count });
    } catch (err) {
      next(err);
    }
  },
);

settingsRoutes.delete("/holidays/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const holiday = await scopedPrisma(req.user!.companyId).holiday.findFirst({
      where: { id: req.params.id },
    });
    if (!holiday) throw new ApiError(404, "NOT_FOUND", "Holiday not found");

    await prisma.holiday.delete({ where: { id: holiday.id } });
    await writeAudit({
      companyId: req.user!.companyId,
      actorId: req.user!.sub,
      action: "HOLIDAY_DELETED",
      entity: "Holiday",
      entityId: holiday.id,
      before: holiday,
    });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

settingsRoutes.get("/next-login-id-preview", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });
    const year = new Date().getUTCFullYear();
    const counter = await prisma.loginIdCounter.findUnique({
      where: { companyId_year: { companyId: company.id, year } },
    });
    const nextSerial = (counter?.lastSerial ?? 0) + 1;

    const preview = buildLoginId({
      companyCode: company.code,
      firstName: "First",
      lastName: "Last",
      joiningYear: year,
      serial: nextSerial,
      serialWidth: company.serialWidth,
    });

    res.json({ preview, serialWidth: company.serialWidth, nextSerial });
  } catch (err) {
    next(err);
  }
});
