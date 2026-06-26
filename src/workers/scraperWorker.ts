import { Worker, Job } from "bullmq";
import { rawQueue } from "../queue/queues";
import {
  SCRAPER_JOB_OPTS,
  scraperBackoffDelay,
  TRANSFORMER_JOB_OPTS,
} from "../queue/jobOptions";
import { scrapeBooks } from "./scrapers/booksScraper";
import { scrapeHN } from "./scrapers/hnScraper";
import { moveToDLQ } from "../queue/dlq";
import { parseJobDescriptor, JobDescriptor } from "../scheduler/jobFactory";
import { markJobRunning } from "../db/jobStatus";
import logger from "../logger";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const concurrency = Number(process.env.SCRAPER_CONCURRENCY) || 3;

export function startScraperWorker() {
  const worker = new Worker(
    "scrape-pending",
    async (job: Job<JobDescriptor>) => {
      const descriptor = parseJobDescriptor(job.data);
      const { jobId, source } = descriptor;

      await markJobRunning(jobId, source);
      logger.info({ module: "scraperWorker", jobId, source }, "Job started");

      let payload;

      if (source === "books") {
        payload = await scrapeBooks();
      } else if (source === "hackernews") {
        payload = await scrapeHN();
      } else {
        throw new Error(`Unknown source: ${source}`);
      }

      await rawQueue.add(
        "raw-data",
        { ...descriptor, payload, attempt: descriptor.attempt + 1 },
        { priority: job.opts.priority, ...TRANSFORMER_JOB_OPTS }
      );

      logger.info({ module: "scraperWorker", jobId, source }, "Job completed");
    },
    {
      connection,
      concurrency,
      limiter: { max: concurrency, duration: 1000 },
      settings: {
        backoffStrategy: scraperBackoffDelay,
      },
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId, source } = job.data;
    const maxAttempts = job.opts.attempts ?? SCRAPER_JOB_OPTS.attempts;
    const retriesExhausted = job.attemptsMade >= maxAttempts;

    if (retriesExhausted) {
      await moveToDLQ(jobId, source, job.data.payload, err);
      logger.error(
        { module: "scraperWorker", jobId, source, err: err.message },
        "Job failed permanently"
      );
    } else {
      logger.warn(
        {
          module: "scraperWorker",
          jobId,
          source,
          attempt: job.attemptsMade,
          maxAttempts,
          err: err.message,
        },
        "Job failed, will retry"
      );
    }
  });

  logger.info({ module: "scraperWorker" }, "Scraper worker started");
  return worker;
}
