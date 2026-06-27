import { Router } from "express";
import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";

const router = Router();
const register = new Registry();

collectDefaultMetrics({ register });

export const jobsCompleted = new Counter({
  name: "dataharvest_jobs_completed_total",
  help: "Total scrape jobs completed",
  labelNames: ["source"],
  registers: [register],
});

export const jobsFailed = new Counter({
  name: "dataharvest_jobs_failed_total",
  help: "Total scrape jobs failed",
  labelNames: ["source"],
  registers: [register],
});

export const queueDepth = new Gauge({
  name: "dataharvest_queue_depth",
  help: "Current queue depth",
  labelNames: ["queue"],
  registers: [register],
});

router.get("/", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
});

export default router;