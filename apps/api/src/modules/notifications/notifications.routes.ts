import { Router } from "express";

import { requireAuth, requirePasswordChanged } from "@/middleware/auth.js";
import { prisma } from "@/lib/prisma.js";
import { ApiError } from "@/middleware/errorHandler.js";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth, requirePasswordChanged);

notificationRoutes.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    const userId = req.user!.sub;

    const [items, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.notification.count({ where: { userId } }),
    ]);

    res.json({ items, unreadCount, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post("/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.sub) {
      throw new ApiError(404, "NOT_FOUND", "Notification not found");
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    res.json({ read: true });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ read: true });
  } catch (err) {
    next(err);
  }
});
