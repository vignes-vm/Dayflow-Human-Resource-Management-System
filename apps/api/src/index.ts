import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler, notFoundHandler } from "@/middleware/errorHandler.js";
import { requestId } from "@/middleware/requestId.js";
import { router } from "@/router.js";
import { logger } from "@/lib/logger.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

app.use(helmet());
app.use(
  cors({
    origin: appUrl.split(","),
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requestId);

app.use("/api/v1", router);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info(`Dayflow API listening on port ${port}`);
  });
}

export { app };
