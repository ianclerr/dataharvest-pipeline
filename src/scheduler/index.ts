import cron from "node-cron";
import { pendingQueue } from "../queue/queues";
import { createJobDescriptor } from "./jobFactory";
import logger from "../logger";

export function startScheduler() {
  const booksCron = process.env.BOOKS_CRON || "0 2 * * *";
  const hnCron = process.env.HN_CRON || "*/15 * * * *";

  cron.schedule(booksCron, async () => {
    const job = createJobDescriptor("books");
    await pendingQueue.add("scrape-books", job, { priority: 2 });
    logger.info({ module: "scheduler", jobId: job.jobId, source: "books" }, "Books job scheduled");
  });

  cron.schedule(hnCron, async () => {
    const job = createJobDescriptor("hackernews");
    await pendingQueue.add("scrape-hn", job, { priority: 1 });
    logger.info({ module: "scheduler", jobId: job.jobId, source: "hackernews" }, "HN job scheduled");
  });

  logger.info({ module: "scheduler" }, "Scheduler started");
}