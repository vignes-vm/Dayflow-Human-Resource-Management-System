import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { requireAuth, requirePasswordChanged, assertSelfOrAdmin } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { avatarUpload, documentUpload } from "@/middleware/upload.js";
import { ApiError } from "@/middleware/errorHandler.js";
import {
  selfUpdateProfileSchema,
  updatePrivateInfoSchema,
  addSkillSchema,
  addCertificationSchema,
} from "@dayflow/shared";

import {
  getResume,
  updateResume,
  addSkill,
  deleteSkill,
  addCertification,
  deleteCertification,
  getPrivateInfo,
  updatePrivateInfo,
  updateAvatar,
  uploadDocument,
  getDocuments,
  getActiveSessions,
  revokeSession,
} from "./profile.service.js";

export const profileRoutes = Router();

// All profile routes require auth + password changed
profileRoutes.use(requireAuth, requirePasswordChanged);

// ---------------------------------------------------------------------------
// Resume — GET and PUT (self or ADMIN/HR)
// ---------------------------------------------------------------------------

profileRoutes.get(
  "/:employeeId/resume",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resume = await getResume(req.params.employeeId!, req.user!.companyId);
      res.json(resume);
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.put(
  "/:employeeId/resume",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  validate(selfUpdateProfileSchema.pick({ about: true, lovesAboutJob: true, hobbies: true })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resume = await updateResume(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.json(resume);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

profileRoutes.post(
  "/:employeeId/skills",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  validate(addSkillSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const skill = await addSkill(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.status(201).json(skill);
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.delete(
  "/:employeeId/skills/:skillId",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteSkill(
        req.params.skillId!,
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

profileRoutes.post(
  "/:employeeId/certifications",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  validate(addCertificationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cert = await addCertification(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
        req.body,
      );
      res.status(201).json(cert);
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.delete(
  "/:employeeId/certifications/:certId",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteCertification(
        req.params.certId!,
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Private Info — GET and PUT (self or ADMIN/HR)
// ---------------------------------------------------------------------------

profileRoutes.get(
  "/:employeeId/private-info",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const info = await getPrivateInfo(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.role,
        req.user!.employeeId,
      );
      res.json(info);
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.put(
  "/:employeeId/private-info",
  validate(updatePrivateInfoSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await updatePrivateInfo(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.role,
        req.user!.employeeId,
        req.user!.sub,
        req.body,
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Avatar upload (self or ADMIN/HR)
// ---------------------------------------------------------------------------

profileRoutes.post(
  "/:employeeId/avatar",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  avatarUpload.single("avatar"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(400, "NO_FILE", "No avatar file provided");
      }
      const result = await updateAvatar(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
        req.file,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Document upload (ADMIN/HR only, or self)
// ---------------------------------------------------------------------------

profileRoutes.post(
  "/:employeeId/documents",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  documentUpload.single("document"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(400, "NO_FILE", "No document file provided");
      }
      const name = (req.body as { name?: string }).name ?? req.file.originalname;
      const doc = await uploadDocument(
        req.params.employeeId!,
        req.user!.companyId,
        req.user!.sub,
        req.file,
        name,
      );
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.get(
  "/:employeeId/documents",
  assertSelfOrAdmin((req) => req.params.employeeId, { allowHr: true }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docs = await getDocuments(req.params.employeeId!, req.user!.companyId);
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Security — active sessions (self only)
// ---------------------------------------------------------------------------

profileRoutes.get(
  "/:employeeId/sessions",
  assertSelfOrAdmin((req) => req.params.employeeId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await getActiveSessions(req.user!.sub);
      res.json({ data: sessions });
    } catch (err) {
      next(err);
    }
  },
);

profileRoutes.delete(
  "/:employeeId/sessions/:sessionId",
  assertSelfOrAdmin((req) => req.params.employeeId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await revokeSession(req.params.sessionId!, req.user!.sub);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
