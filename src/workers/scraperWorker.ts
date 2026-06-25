import { Worker, Job } from "bullmq";
import { rawQueue } from "../queue/queues";
import { scrapeBooks } from "./scrapers/booksScraper";
import { scrapeHN } from "./scrapers/hnScraper";
import { moveToDLQ } from "../queue/dlq";
import { JobDescriptor } from "../scheduler/jobFactory";
import logger from "../logger";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const concurrency = Number(process.env.SCRAPER_CONCURRENCY) || 3;

export function startScraperWorker() {
  const worker = new Worker(
    "scrape:pending",
    async (job: Job<JobDescriptor>) => {
      const { jobId, source } = job.data;

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
        { ...job.data, payload, attempt: job.data.attempt + 1 },
        { priority: job.opts.priority }
      );

      logger.info({ module: "scraperWorker", jobId, source }, "Job completed");
    },
    {
      connection,
      concurrency,
      limiter: { max: concurrency, duration: 1000 },
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const retriesExhausted = job.attemptsMade >= (job.opts.attempts || 3);
    if (retriesExhausted) {
      await moveToDLQ(job.data.jobId, job.data.source, job.data.payload, err);
      logger.error(
        { module: "scraperWorker", jobId: job.data.jobId, err: err.message },
        "Job moved to DLQ"
      );
    }
  });

  logger.info({ module: "scraperWorker" }, "Scraper worker started");
  return worker;
}