import cron from "node-cron";

import { prisma } from "@/lib/prisma.js";
import { pushToUsers } from "@/lib/sse.js";

/**
 * Presence (GREEN/AIRPLANE/YELLOW/RED) is computed live on every read, so
 * this sweep doesn't recompute anything — it just nudges connected clients
 * to re-fetch, so a dot flipping YELLOW at the absence cutoff (with nobody
 * having taken any action) still shows up without a manual refresh.
 */
export async function runPresenceSweep(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    const users = await prisma.user.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      select: { id: true },
    });
    pushToUsers(
      users.map((u) => u.id),
      { type: "presence:refresh", data: {} },
    );
  }
}

/** Every 5 minutes. */
export function schedulePresenceSweep(): void {
  cron.schedule("*/5 * * * *", () => {
    runPresenceSweep().catch(() => {});
  });
}
