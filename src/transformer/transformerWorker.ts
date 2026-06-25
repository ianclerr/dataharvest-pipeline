import { Worker, Job } from "bullmq";
import { processedQueue } from "../queue/queues";
import { transformBook } from "./bookTransformer";
import { transformHNStory } from "./hnTransformer";
import { moveToDLQ } from "../queue/dlq";
import { JobDescriptor } from "../scheduler/jobFactory";
import logger from "../logger";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const concurrency = Number(process.env.TRANSFORMER_CONCURRENCY) || 5;

export function startTransformerWorker() {
  const worker = new Worker(
    "scrape-raw",
    async (job: Job<JobDescriptor>) => {
      const { jobId, source, payload } = job.data;

      logger.info(
        { module: "transformerWorker", jobId, source },
        "Transforming job"
      );

      const items = (payload as unknown) as unknown[];
      let transformed;

      if (source === "books") {
        transformed = items.map(transformBook);
      } else if (source === "hackernews") {
        transformed = items.map(transformHNStory);
      } else {
        throw new Error(`Unknown source: ${source}`);
      }

      await processedQueue.add(
        "processed-data",
        { ...job.data, payload: transformed },
        { priority: job.opts.priority }
      );

      logger.info(
        { module: "transformerWorker", jobId, source },
        "Transform completed"
      );
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    await moveToDLQ(job.data.jobId, job.data.source, job.data.payload, err);
    logger.error(
      { module: "transformerWorker", jobId: job.data.jobId, err: err.message },
      "Transform job moved to DLQ"
    );
  });

  logger.info({ module: "transformerWorker" }, "Transformer worker started");
  return worker;
}