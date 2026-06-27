import { Worker, Job } from "bullmq";
import { rawQueue, connection } from "../queue/queues";
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
      settings: {
        // BullMQ solo invoca backoffStrategy cuando SCRAPER_JOB_OPTS.backoff.type
        // es 'custom' — con 'exponential' usaría su propia fórmula sin nuestro cap de 30s.
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

  // Sin este listener, un EventEmitter que emite 'error' sin oyentes (p. ej.
  // un fallo de conexión a Redis) termina el proceso con una excepción no capturada.
  worker.on("error", (err) => {
    logger.error({ module: "scraperWorker", err: err.message }, "Worker error");
  });

  logger.info({ module: "scraperWorker" }, "Scraper worker started");
  return worker;
}
