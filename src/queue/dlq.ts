import { dlqQueue } from "./queues";

export async function moveToDLQ(
  jobId: string,
  source: string,
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
}