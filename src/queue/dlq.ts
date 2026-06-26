import { dlqQueue } from "./queues";
import { markJobFailed } from "../db/jobStatus";
import type { JobSource } from "../scheduler/jobFactory";
import logger from "../logger";

export async function moveToDLQ(
  jobId: string,
  source: JobSource,
  payload: unknown,
  error: Error
) {
  await dlqQueue.add(
    "dlq-job",
    {
      jobId,
      source,
      payload,
      error: error.message,
      stack: error.stack,
      failedAt: new Date().toISOString(),
    },
    { removeOnComplete: false }
  );

  await markJobFailed(jobId, error, source);

  logger.error(
    { module: "dlq", jobId, source, err: error.message, stack: error.stack },
    "Job moved to DLQ"
  );
}
