import cron from "node-cron";

import { prisma } from "@/lib/prisma.js";
import { logger } from "@/lib/logger.js";
import { closeAttendanceDay } from "@/modules/attendance/attendance.service.js";

/**
 * Closes today's attendance for every company — auto-closes missed
 * checkouts, marks weekends/holidays, and derives ABSENT where due.
 * Idempotent: safe to run more than once for the same day.
 */
export async function runDailyClose(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    try {
      await closeAttendanceDay(company.id);
    } catch (err) {
      logger.error("daily close failed for company", { companyId: company.id, err: String(err) });
    }
  }
}

/** Scheduled at 23:59 server time every day. */
export function scheduleDailyClose(): void {
  cron.schedule("59 23 * * *", () => {
    runDailyClose().catch((err) => logger.error("daily close job crashed", { err: String(err) }));
  });
}
