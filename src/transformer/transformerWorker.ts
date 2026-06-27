import { Worker, Job } from "bullmq";
import { processedQueue, connection } from "../queue/queues";
import { PERSISTER_JOB_OPTS, TRANSFORMER_JOB_OPTS } from "../queue/jobOptions";
import { transformBook } from "./bookTransformer";
import { transformHNStory } from "./hnTransformer";
import { moveToDLQ } from "../queue/dlq";
import { parseJobDescriptor, JobDescriptor } from "../scheduler/jobFactory";
import logger from "../logger";

const concurrency = Number(process.env.TRANSFORMER_CONCURRENCY) || 5;

export function startTransformerWorker() {
  const worker = new Worker(
    "scrape-raw",
    async (job: Job<JobDescriptor>) => {
      const descriptor = parseJobDescriptor(job.data);
      const { jobId, source, payload } = descriptor;

      logger.info(
        { module: "transformerWorker", jobId, source },
        "Transforming job"
      );

      // Los payloads vacíos del scheduler llegan como {}, solo arrays son válidos aquí
      if (!Array.isArray(payload)) {
        throw new Error(
          `Payload must be an array, got: ${typeof payload}`
        );
      }
      const items = payload as unknown[];

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
        { ...descriptor, payload: transformed },
        { priority: job.opts.priority, ...PERSISTER_JOB_OPTS }
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
    const { jobId, source } = job.data;
    const maxAttempts = TRANSFORMER_JOB_OPTS.attempts ?? 2;
    const retriesExhausted = job.attemptsMade >= maxAttempts;

    if (retriesExhausted) {
      await moveToDLQ(jobId, source, job.data.payload, err);
      logger.error(
        { module: "transformerWorker", jobId, source, err: err.message },
        "Transform job failed permanently"
      );
    } else {
      logger.warn(
        {
          module: "transformerWorker",
          jobId,
          source,
          attempt: job.attemptsMade,
          maxAttempts,
          err: err.message,
        },
        "Transform job failed, will retry"
      );
    }
  });

  // Sin este listener, un EventEmitter que emite 'error' sin oyentes (p. ej.
  // un fallo de conexión a Redis) termina el proceso con una excepción no capturada.
  worker.on("error", (err) => {
    logger.error({ module: "transformerWorker", err: err.message }, "Worker error");
  });

  logger.info({ module: "transformerWorker" }, "Transformer worker started");
  return worker;
}
