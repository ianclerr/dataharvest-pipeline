import cron from "node-cron";
import { pendingQueue } from "../queue/queues";
import { SCRAPER_JOB_OPTS } from "../queue/jobOptions";
import { createJobDescriptor } from "./jobFactory";
import db from "../db/client";
import logger from "../logger";

async function scheduleJob(source: "books" | "hackernews", priority: number) {
  const job = createJobDescriptor(source);
  await pendingQueue.add(`scrape-${source}`, job, { priority, ...SCRAPER_JOB_OPTS });
  await db("scrape_jobs").insert({
    id: job.jobId,
    source,
    status: "pending",
    triggered_at: new Date(),
  });
  logger.info({ module: "scheduler", jobId: job.jobId, source }, "Job scheduled");
}

export function startScheduler() {
  const booksCron = process.env.BOOKS_CRON || "0 2 * * *";
  const hnCron = process.env.HN_CRON || "*/15 * * * *";

  cron.schedule(booksCron, () => scheduleJob("books", 2));
  cron.schedule(hnCron, () => scheduleJob("hackernews", 1));

  logger.info({ module: "scheduler" }, "Scheduler started");
}