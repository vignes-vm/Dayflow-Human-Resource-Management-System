import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/", (_req, res) => {
  res.json({ status: "ok", service: "@dayflow/api", time: new Date().toISOString() });
});
