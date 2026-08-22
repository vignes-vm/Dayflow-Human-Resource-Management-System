import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
  assertSelfOrAdmin,
} from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { contractPreviewSchema, createContractSchema } from "@dayflow/shared";

import { previewContract, createContract, getContracts } from "./contracts.service.js";

export const contractRoutes = Router();

// All contract routes require auth + password changed
contractRoutes.use(requireAuth, requirePasswordChanged);

// ---------------------------------------------------------------------------
// POST /contracts/preview — dry run mathematical preview
// ---------------------------------------------------------------------------

contractRoutes.post(
  "/preview",
  requireRole("ADMIN"),
  validate(contractPreviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await previewContract(req.user!.companyId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /contracts — create a new effective-dated contract
// ---------------------------------------------------------------------------

contractRoutes.post(
  "/",
  requireRole("ADMIN"),
  validate(createContractSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await createContract(req.user!.companyId, req.user!.sub, req.body);
      res.status(201).json(contract);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /contracts/:employeeId — list historical contracts
// ---------------------------------------------------------------------------

contractRoutes.get(
  "/:employeeId",
  assertSelfOrAdmin((req) => req.params.employeeId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contracts = await getContracts(req.params.employeeId!, req.user!.companyId);
      res.json({ data: contracts });
    } catch (err) {
      next(err);
    }
  },
);
