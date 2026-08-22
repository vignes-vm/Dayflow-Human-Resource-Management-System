import { Prisma } from "@prisma/client";

/**
 * Race-safe per-(company, year) serial allocation for the Login ID engine.
 * Runs inside the caller's transaction; the increment is a single atomic
 * `UPDATE ... SET lastSerial = lastSerial + 1` at the SQL level, so
 * concurrent callers serialize on the row lock rather than racing in
 * application code. The only gap — two concurrent first-of-year callers
 * both attempting the initial `create` — is closed by retrying into the
 * update path on a unique-constraint conflict.
 */
export async function allocateSerial(
  tx: Prisma.TransactionClient,
  companyId: string,
  year: number,
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await tx.loginIdCounter.findUnique({
      where: { companyId_year: { companyId, year } },
    });

    try {
      if (!existing) {
        const created = await tx.loginIdCounter.create({
          data: { companyId, year, lastSerial: 1 },
        });
        return created.lastSerial;
      }

      const updated = await tx.loginIdCounter.update({
        where: { id: existing.id },
        data: { lastSerial: { increment: 1 } },
      });
      return updated.lastSerial;
    } catch (err) {
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isConflict || attempt === 4) throw err;
    }
  }
  throw new Error("unreachable");
}
