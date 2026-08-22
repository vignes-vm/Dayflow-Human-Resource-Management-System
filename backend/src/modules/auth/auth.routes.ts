import { Router } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerCompanySchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@dayflow/shared";

import { requireAuth } from "@/middleware/auth.js";
import {
  forgotPasswordRateLimit,
  loginRateLimit,
  registerCompanyRateLimit,
} from "@/middleware/rateLimit.js";
import { validate } from "@/middleware/validate.js";
import { clearAuthCookies, setAuthCookies } from "@/modules/auth/auth.cookies.js";
import * as authService from "@/modules/auth/auth.service.js";

export const authRoutes = Router();

const isDev = process.env.NODE_ENV !== "production";

authRoutes.post(
  "/register-company",
  registerCompanyRateLimit,
  validate(registerCompanySchema),
  async (req, res, next) => {
    try {
      const result = await authService.registerCompany(req.body);
      res.status(201).json({
        companyId: result.companyId,
        loginId: result.loginId,
        email: result.email,
        ...(isDev ? { verifyUrl: result.verifyUrl, emailPreviewUrl: result.emailPreviewUrl } : {}),
      });
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.get("/verify", validate(verifyEmailSchema, "query"), async (req, res, next) => {
  try {
    await authService.verifyEmail((req.query as unknown as { token: string }).token);
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/login", loginRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body.identifier, req.body.password);
    setAuthCookies(res, result);
    res.json({ mustChangePassword: result.mustChangePassword });
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) {
      res
        .status(401)
        .json({ error: { code: "INVALID_REFRESH_TOKEN", message: "No session to refresh." } });
      return;
    }
    const result = await authService.refreshSession(refreshToken);
    setAuthCookies(res, result);
    res.json({ mustChangePassword: result.mustChangePassword });
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/logout", async (req, res, next) => {
  try {
    await authService.logout(req.cookies?.refresh_token as string | undefined);
    clearAuthCookies(res);
    res.json({ loggedOut: true });
  } catch (err) {
    next(err);
  }
});

authRoutes.get("/me", requireAuth, async (req, res, next) => {
  try {
    const me = await authService.getMe(req.user!.sub);
    res.json(me);
  } catch (err) {
    next(err);
  }
});

authRoutes.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      await authService.changePassword(
        req.user!.sub,
        req.body.currentPassword,
        req.body.newPassword,
      );
      res.json({ changed: true });
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  "/forgot-password",
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const result = await authService.forgotPassword(req.body.email);
      res.json({
        sent: true,
        ...(isDev ? { resetUrl: result.resetUrl, emailPreviewUrl: result.emailPreviewUrl } : {}),
      });
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post("/reset-password", validate(resetPasswordSchema), async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ reset: true });
  } catch (err) {
    next(err);
  }
});
