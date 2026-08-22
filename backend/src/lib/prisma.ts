import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. Every list/read query must be scoped by companyId
 * (CLAUDE.md rule 5) — `scopedPrisma(companyId)` below returns an extended
 * client that injects `where.companyId` automatically on `findMany` and
 * `findFirst` for every tenant-owned model, so a route can't forget it.
 *
 * Tenant models are every model that carries a `companyId` column directly
 * (see prisma/schema.prisma). Models reached only through a relation — e.g.
 * PrivateInfo via Employee — are not in this list; scope those queries by
 * joining through the tenant-owned parent instead.
 *
 * DELIBERATE BYPASS: use the raw `prisma` export (not `scopedPrisma`) for the
 * handful of places that must legitimately cross the tenant boundary before a
 * companyId is known — company registration, and login lookup by loginId/email
 * (POST /auth/login has to find the user before it knows which company they're
 * in). Every other query in a request handler should go through
 * `scopedPrisma(req.user.companyId)`.
 */

export const prisma = new PrismaClient();

const TENANT_MODELS = new Set([
  "Employee",
  "Department",
  "AttendanceRecord",
  "TimeOffType",
  "TimeOffAllocation",
  "TimeOffRequest",
  "Contract",
  "Payslip",
  "Holiday",
  "Setting",
  "AuditLog",
  "Notification",
  "Document",
  "LoginIdCounter",
]);

export function scopedPrisma(companyId: string) {
  return prisma.$extends({
    name: "companyScope",
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...(args.where ?? {}), companyId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            args.where = { ...(args.where ?? {}), companyId };
          }
          return query(args);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof scopedPrisma>;
