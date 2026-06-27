import express, { Request, Response, NextFunction } from "express";
import jobsRouter from "./routes/jobs";
import booksRouter from "./routes/books";
import storiesRouter from "./routes/stories";
import metricsRouter from "./routes/metrics";
import healthRouter from "./routes/health";
import { requestLogger } from "./middleware/requestLogger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./openapi";
import logger from "../logger";
import prometheusRouter from "./routes/prometheus";
import serverAdapter from "./admin/queues";
import basicAuth from "basic-auth";
import eventsRouter from "./routes/events";

const app = express();
app.use(express.json());
app.use(requestLogger);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/metrics", prometheusRouter);
app.use("/admin/queues", (req, res, next) => {
  const user = basicAuth(req);
  const validUser = process.env.ADMIN_USER || "admin";
  const validPass = process.env.ADMIN_PASSWORD || "admin";

  if (!user || user.name !== validUser || user.pass !== validPass) {
    res.set("WWW-Authenticate", 'Basic realm="Bull Dashboard"');
    return res.status(401).send("Unauthorized");
  }
  next();
});
app.use("/api/v1/events", eventsRouter);
app.use("/admin/queues", serverAdapter.getRouter());
app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/books", booksRouter);
app.use("/api/v1/stories", storiesRouter);
app.use("/api/v1/metrics", metricsRouter);
app.use("/api/v1/health", healthRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ module: "server", err: err.message }, "Unhandled error");
  res.status(500).json({ error: err.message });
});

export default app;