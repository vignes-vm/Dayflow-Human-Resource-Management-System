import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { ApiError } from "@/middleware/errorHandler.js";

export interface AccessTokenPayload {
  sub: string; // User.id
  companyId: string;
  role: "ADMIN" | "HR" | "EMPLOYEE";
  employeeId: string | null;
  mustChangePassword: boolean;
  typ: "access";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return secret;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "access" }, accessSecret(), {
    expiresIn: process.env.ACCESS_TTL ?? "15m",
  } as jwt.SignOptions);
}

/** Requires a valid access-token cookie. Sets req.user or responds 401. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    next(new ApiError(401, "UNAUTHENTICATED", "Sign in required"));
    return;
  }
  try {
    const payload = jwt.verify(token, accessSecret()) as AccessTokenPayload;
    if (payload.typ !== "access") throw new Error("wrong token type");
    req.user = payload;
    next();
  } catch {
    next(new ApiError(401, "UNAUTHENTICATED", "Session expired or invalid"));
  }
}

/** Blocks every route except the mustChangePassword allow-list — attach after requireAuth. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.mustChangePassword) {
    next(
      new ApiError(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "You must change your password before continuing",
      ),
    );
    return;
  }
  next();
}

export function requireRole(...roles: Array<"ADMIN" | "HR" | "EMPLOYEE">) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError(403, "FORBIDDEN", "You don't have access to this"));
      return;
    }
    next();
  };
}

/** Guards a resource that carries an explicit companyId in params/body against cross-tenant access. */
export function requireCompanyScope(extractCompanyId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const targetCompanyId = extractCompanyId(req);
    if (!req.user || (targetCompanyId && targetCompanyId !== req.user.companyId)) {
      next(new ApiError(403, "FORBIDDEN", "You don't have access to this"));
      return;
    }
    next();
  };
}

/** Allows ADMIN (and optionally HR) through unconditionally; otherwise the target must be the caller. */
export function assertSelfOrAdmin(
  extractEmployeeId: (req: Request) => string | undefined,
  options: { allowHr?: boolean } = {},
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const target = extractEmployeeId(req);
    const isPrivileged = req.user?.role === "ADMIN" || (options.allowHr && req.user?.role === "HR");
    if (!req.user || (!isPrivileged && target !== req.user.employeeId)) {
      next(new ApiError(403, "FORBIDDEN", "You don't have access to this"));
      return;
    }
    next();
  };
}
