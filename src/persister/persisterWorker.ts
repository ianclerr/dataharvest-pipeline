import { Worker, Job } from "bullmq";
import { upsertBooks, upsertStories } from "./upsert";
import { moveToDLQ } from "../queue/dlq";
import { JobDescriptor } from "../scheduler/jobFactory";
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
      const { jobId, source, payload } = job.data;

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
    const retriesExhausted = job.attemptsMade >= 5;
    if (retriesExhausted) {
      await moveToDLQ(job.data.jobId, job.data.source, job.data.payload, err);
      logger.error(
        { module: "persisterWorker", jobId: job.data.jobId, err: err.message },
        "Persist job moved to DLQ"
      );
    }
  });

  logger.info({ module: "persisterWorker" }, "Persister worker started");
  return worker;
}