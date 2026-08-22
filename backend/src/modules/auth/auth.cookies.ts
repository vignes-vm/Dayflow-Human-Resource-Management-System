import type { Response } from "express";

import { parseDurationMs } from "@/lib/duration.js";

function cookieOptions(maxAgeMs: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    maxAge: maxAgeMs,
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  params: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
): void {
  res.cookie(
    "access_token",
    params.accessToken,
    cookieOptions(parseDurationMs(process.env.ACCESS_TTL ?? "15m")),
  );
  res.cookie(
    "refresh_token",
    params.refreshToken,
    cookieOptions(params.refreshExpiresAt.getTime() - Date.now()),
  );
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}
