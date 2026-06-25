import { Router } from "express";
import db from "../../db/client";
import { pendingQueue, dlqQueue } from "../../queue/queues";
import { createJobDescriptor } from "../../scheduler/jobFactory";
import logger from "../../logger";

const router = Router();

// POST /api/v1/jobs/trigger
router.post("/trigger", async (req, res) => {
  try {
    const { source } = req.body;
    if (!["books", "hackernews"].includes(source)) {
      return res.status(400).json({ error: "source must be books or hackernews" });
    }

    const job = createJobDescriptor(source);
    const priority = source === "hackernews" ? 1 : 2;
    await pendingQueue.add(`scrape-${source}`, job, { priority });

    await db("scrape_jobs").insert({
      id: job.jobId,
      source,
      status: "pending",
      triggered_at: new Date(),
    });

    logger.info({ module: "jobs", jobId: job.jobId, source }, "Job triggered manually");
    return res.status(201).json({ jobId: job.jobId, source, status: "pending" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/jobs
router.get("/", async (req, res) => {
  try {
    const { status, source, limit = 20, offset = 0 } = req.query;
    const query = db("scrape_jobs").orderBy("triggered_at", "desc")
      .limit(Number(limit)).offset(Number(offset));

    if (status) query.where("status", status);
    if (source) query.where("source", source);

    const jobs = await query;
    return res.json(jobs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/jobs/dlq
router.get("/dlq", async (req, res) => {
  try {
    const jobs = await dlqQueue.getJobs(["waiting", "failed"], 0, 49);
    return res.json(jobs.map((j) => ({ id: j.id, data: j.data })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/jobs/dlq/:jobId
router.delete("/dlq/:jobId", async (req, res) => {
  try {
    const job = await dlqQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    await job.remove();
    return res.json({ message: "Job removed from DLQ" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/jobs/dlq/:jobId/retry
router.post("/dlq/:jobId/retry", async (req, res) => {
  try {
    const job = await dlqQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    await pendingQueue.add("retry-job", job.data, { priority: 1 });
    await job.remove();
    return res.json({ message: "Job re-queued for processing" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/jobs/:id
router.get("/:id", async (req, res) => {
  try {
    const job = await db("scrape_jobs").where("id", req.params.id).first();
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;