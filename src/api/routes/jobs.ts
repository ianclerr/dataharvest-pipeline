import { Router } from "express";
import db from "../../db/client";
import { pendingQueue, dlqQueue } from "../../queue/queues";
import { SCRAPER_JOB_OPTS } from "../../queue/jobOptions";
import { createJobDescriptor, parseJobDescriptor } from "../../scheduler/jobFactory";
import { resetJobForRetry } from "../../db/jobStatus";
import logger from "../../logger";

const router = Router();

router.post("/trigger", async (req, res) => {
  try {
    const { source } = req.body;
    if (!["books", "hackernews"].includes(source)) {
      return res.status(400).json({ error: "source must be books or hackernews" });
    }

    const job = createJobDescriptor(source);
    parseJobDescriptor(job);
    const priority = source === "hackernews" ? 1 : 2;
    await pendingQueue.add(`scrape-${source}`, job, { priority, ...SCRAPER_JOB_OPTS });

    await db("scrape_jobs").insert({
      id: job.jobId,
      source,
      status: "pending",
      triggered_at: new Date(),
    });

    logger.info({ module: "jobs", jobId: job.jobId, source }, "Job triggered manually");
    return res.status(201).json({ jobId: job.jobId, source, status: "pending" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, source, limit = 20, offset = 0 } = req.query;
    const query = db("scrape_jobs").orderBy("triggered_at", "desc")
      .limit(Number(limit)).offset(Number(offset));

    if (status) query.where("status", status);
    if (source) query.where("source", source);

    const jobs = await query;
    return res.json(jobs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.get("/dlq", async (_req, res) => {
  try {
    const jobs = await dlqQueue.getJobs(["waiting", "failed"], 0, 49);
    return res.json(jobs.map((j) => ({ id: j.id, data: j.data })));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.delete("/dlq/:jobId", async (req, res) => {
  try {
    const job = await dlqQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    await job.remove();
    return res.json({ message: "Job removed from DLQ" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.post("/dlq/:jobId/retry", async (req, res) => {
  try {
    const job = await dlqQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const { jobId, source, payload } = job.data as {
      jobId: string;
      source: "books" | "hackernews";
      payload?: Record<string, unknown>;
    };
    const priority = source === "hackernews" ? 1 : 2;
    const descriptor = createJobDescriptor(source);
    const retryJob = {
      jobId: jobId || descriptor.jobId,
      source,
      createdAt: new Date().toISOString(),
      payload: payload ?? {},
      attempt: 1,
    };
    parseJobDescriptor(retryJob);

    await resetJobForRetry(retryJob.jobId, source);
    await pendingQueue.add("retry-job", retryJob, { priority, ...SCRAPER_JOB_OPTS });
    await job.remove();
    return res.json({ message: "Job re-queued for processing", jobId: retryJob.jobId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const job = await db("scrape_jobs").where("id", req.params.id).first();
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

export default router;