import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { logger } from "@/lib/logger.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header("x-request-id") ?? randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      requestId: id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}
