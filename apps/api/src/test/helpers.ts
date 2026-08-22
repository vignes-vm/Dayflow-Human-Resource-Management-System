import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import type { Role } from "@prisma/client";

import { app } from "@/index.js";
import { prisma } from "@/lib/prisma.js";

export const TEST_PASSWORD = "Str0ngPass!";

/** Creates a company + verified user directly via Prisma and signs in, bypassing the register-company flow. */
export async function createSignedInUser(role: Role = "ADMIN") {
  const suffix = randomUUID().slice(0, 8);
  const company = await prisma.company.create({
    data: { name: `Test Co ${suffix}`, code: "TC" },
  });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      loginId: `TCJODO2026${suffix.slice(0, 4).toUpperCase()}`,
      email: `user-${suffix}@example.com`,
      passwordHash,
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const agent = request.agent(app);
  const loginRes = await agent
    .post("/api/v1/auth/login")
    .send({ identifier: user.email, password: TEST_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(`test login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return { agent, user, company };
}
