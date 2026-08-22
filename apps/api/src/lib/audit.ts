import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma.js";

export interface WriteAuditParams {
  companyId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Every mutating route writes one of these — see CLAUDE.md rule 4. */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      before:
        params.before === undefined ? Prisma.JsonNull : (params.before as Prisma.InputJsonValue),
      after: params.after === undefined ? Prisma.JsonNull : (params.after as Prisma.InputJsonValue),
      ip: params.ip,
    },
  });
}
