import db from "./client";
import logger from "../logger";
import type { JobSource } from "../scheduler/jobFactory";

export async function markJobRunning(jobId: string, source?: JobSource) {
  const updated = await db("scrape_jobs").where("id", jobId).update({ status: "running" });
  if (updated > 0) {
    logger.info(
      { module: "jobStatus", jobId, source, status: "running" },
      "Job state transition"
    );
  }
}

export async function markJobFailed(jobId: string, error: Error, source?: JobSource) {
  await db("scrape_jobs")
    .where("id", jobId)
    .update({
      status: "failed",
      completed_at: new Date(),
      error_message: error.stack ?? error.message,
    });

  logger.error(
    { module: "jobStatus", jobId, source, status: "failed", err: error.message },
    "Job state transition"
  );
}

export async function markJobDone(jobId: string, source?: JobSource) {
  await db("scrape_jobs")
    .where("id", jobId)
    .update({
      status: "done",
      completed_at: new Date(),
      error_message: null,
    });

  logger.info(
    { module: "jobStatus", jobId, source, status: "done" },
    "Job state transition"
  );
}

export async function resetJobForRetry(jobId: string, source: JobSource) {
  const updated = await db("scrape_jobs").where("id", jobId).update({
    status: "pending",
    completed_at: null,
    error_message: null,
    triggered_at: new Date(),
  });

  if (updated === 0) {
    await db("scrape_jobs").insert({
      id: jobId,
      source,
      status: "pending",
      triggered_at: new Date(),
    });
  }

  logger.info(
    { module: "jobStatus", jobId, source, status: "pending" },
    "Job reset for retry"
  );
}
