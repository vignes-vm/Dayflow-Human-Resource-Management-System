import { prisma } from "@/lib/prisma.js";
import { pushToUsers } from "@/lib/sse.js";
import { logger } from "@/lib/logger.js";

export interface NotifyParams {
  companyId: string;
  userIds: string[];
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** If provided, also sends this email to each recipient. Failures never throw. */
  email?: {
    to: (userId: string) => string | undefined;
    send: (to: string) => Promise<unknown>;
  };
}

/**
 * Writes a Notification row per recipient, pushes it over SSE to any open
 * tabs, and optionally queues an email. Called by feature modules (time off,
 * payroll, attendance, employees) whenever something notification-worthy
 * happens — see docs/Dayflow-Blueprint-v2.md Step 17 for the full trigger list.
 */
export async function notify(params: NotifyParams): Promise<void> {
  if (params.userIds.length === 0) return;

  const rows = await prisma.$transaction(
    params.userIds.map((userId) =>
      prisma.notification.create({
        data: {
          companyId: params.companyId,
          userId,
          type: params.type,
          title: params.title,
          body: params.body,
          link: params.link,
        },
      }),
    ),
  );

  for (const row of rows) {
    pushToUsers([row.userId], {
      type: "notification",
      data: {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        createdAt: row.createdAt,
      },
    });
  }

  if (params.email) {
    await Promise.all(
      params.userIds.map(async (userId) => {
        const to = params.email!.to(userId);
        if (!to) return;
        try {
          await params.email!.send(to);
        } catch (err) {
          logger.error("notification email failed", {
            userId,
            type: params.type,
            error: String(err),
          });
        }
      }),
    );
  }
}
