import express from "express";
import jobsRouter from "./routes/jobs";
import booksRouter from "./routes/books";
import storiesRouter from "./routes/stories";
import metricsRouter from "./routes/metrics";
import healthRouter from "./routes/health";
import logger from "../logger";

const app = express();
app.use(express.json());

app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/books", booksRouter);
app.use("/api/v1/stories", storiesRouter);
app.use("/api/v1/metrics", metricsRouter);
app.use("/api/v1/health", healthRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ module: "server", err: err.message }, "Unhandled error");
  res.status(500).json({ error: err.message });
});

export default app;
