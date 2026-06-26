import { Worker, Job } from "bullmq";
import { upsertBooks, upsertStories } from "./upsert";
import { moveToDLQ } from "../queue/dlq";
import { PERSISTER_JOB_OPTS } from "../queue/jobOptions";
import { parseJobDescriptor, JobDescriptor } from "../scheduler/jobFactory";
import { markJobDone } from "../db/jobStatus";
import { Book } from "../transformer/bookTransformer";
import { HNStory } from "../transformer/hnTransformer";
import logger from "../logger";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const concurrency = Number(process.env.PERSISTER_CONCURRENCY) || 2;

export function startPersisterWorker() {
  const worker = new Worker(
    "scrape-processed",
    async (job: Job<JobDescriptor>) => {
      const descriptor = parseJobDescriptor(job.data);
      const { jobId, source, payload } = descriptor;

      logger.info(
        { module: "persisterWorker", jobId, source },
        "Persisting job"
      );

      if (source === "books") {
        await upsertBooks(payload as unknown as Book[]);
      } else if (source === "hackernews") {
        await upsertStories(payload as unknown as HNStory[]);
      } else {
        throw new Error(`Unknown source: ${source}`);
      }

      await markJobDone(jobId, source);

      logger.info(
        { module: "persisterWorker", jobId, source },
        "Persist completed"
      );
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId, source } = job.data;
    const maxAttempts = PERSISTER_JOB_OPTS.attempts ?? 5;
    const retriesExhausted = job.attemptsMade >= maxAttempts;

    if (retriesExhausted) {
      await moveToDLQ(jobId, source, job.data.payload, err);
      logger.error(
        { module: "persisterWorker", jobId, source, err: err.message },
        "Persist job failed permanently"
      );
    } else {
      logger.warn(
        {
          module: "persisterWorker",
          jobId,
          source,
          attempt: job.attemptsMade,
          maxAttempts,
          err: err.message,
        },
        "Persist job failed, will retry"
      );
    }
  });

  logger.info({ module: "persisterWorker" }, "Persister worker started");
  return worker;
}
