import { Router } from "express";

import { requireAuth } from "@/middleware/auth.js";
import { registerClient, unregisterClient } from "@/lib/sse.js";

export const streamRoutes = Router();

const HEARTBEAT_MS = 25_000;

streamRoutes.get("/", requireAuth, (req, res) => {
  const userId = req.user!.sub;

  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  registerClient(userId, res);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterClient(userId, res);
  });
});
