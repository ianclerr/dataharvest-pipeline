import { Router } from "express";
import { Queue } from "bullmq";
import { pendingQueue, rawQueue, processedQueue, dlqQueue } from "../../queue/queues";
import db from "../../db/client";
import logger from "../../logger";

const router = Router();

const ONE_HOUR_MS = 60 * 60 * 1000;

// Límite razonable por cola — evita cargar cientos de Job objects pesados.
// Trade-off documentado: en alta carga puede subestimar métricas de la última hora.
const METRICS_JOB_FETCH_LIMIT = 100;

async function getQueueMetricsLastHour(queue: Queue, name: string) {
  const oneHourAgo = Date.now() - ONE_HOUR_MS;

  // Limitamos a 100 jobs recientes por cola para no sobrecargar Redis en consultas de métricas
  // Los jobs más recientes están al final del rango, por eso start=0
  const [completedJobs, failedJobs, counts] = await Promise.all([
    queue.getJobs(["completed"], 0, METRICS_JOB_FETCH_LIMIT - 1),
    queue.getJobs(["failed"], 0, METRICS_JOB_FETCH_LIMIT - 1),
    queue.getJobCounts(),
  ]);

  const recentCompleted = completedJobs.filter(
    (job) => job.finishedOn && job.finishedOn >= oneHourAgo
  );
  const recentFailed = failedJobs.filter(
    (job) => job.finishedOn && job.finishedOn >= oneHourAgo
  );

  const latencies = recentCompleted
    .filter((job) => job.processedOn && job.finishedOn)
    .map((job) => job.finishedOn! - job.processedOn!);

  const averageProcessingLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length)
      : null;

  const total = recentCompleted.length + recentFailed.length;
  const errorRate =
    total > 0 ? parseFloat((recentFailed.length / total).toFixed(4)) : 0;

  return {
    name,
    depth: counts,
    lastHour: {
      completed: recentCompleted.length,
      failed: recentFailed.length,
      pending: (counts.waiting ?? 0) + (counts.active ?? 0),
      throughput: recentCompleted.length,
      errorRate,
      averageProcessingLatencyMs,
    },
  };
}

router.get("/", async (_req, res) => {
  try {
    const [pending, raw, processed, dlq, lastRuns] = await Promise.all([
      getQueueMetricsLastHour(pendingQueue, "scrape:pending"),
      getQueueMetricsLastHour(rawQueue, "scrape:raw"),
      getQueueMetricsLastHour(processedQueue, "scrape:processed"),
      getQueueMetricsLastHour(dlqQueue, "scrape:dlq"),
      db("scrape_jobs")
        .select("source")
        .max("completed_at as lastSuccessfulRun")
        .where("status", "done")
        .whereNotNull("completed_at")
        .groupBy("source"),
    ]);

    const lastSuccessfulRunBySource: Record<string, string | Date> = {};
    for (const row of lastRuns) {
      lastSuccessfulRunBySource[row.source as string] =
        row.lastSuccessfulRun as string | Date;
    }

    const allLatencies = [
      pending.lastHour.averageProcessingLatencyMs,
      raw.lastHour.averageProcessingLatencyMs,
      processed.lastHour.averageProcessingLatencyMs,
    ].filter((v): v is number => v !== null);

    const averageProcessingLatencyMs =
      allLatencies.length > 0
        ? Math.round(
            allLatencies.reduce((sum, ms) => sum + ms, 0) / allLatencies.length
          )
        : null;

    return res.json({
      queues: {
        "scrape:pending": { depth: pending.depth, lastHour: pending.lastHour },
        "scrape:raw": { depth: raw.depth, lastHour: raw.lastHour },
        "scrape:processed": {
          depth: processed.depth,
          lastHour: processed.lastHour,
        },
        "scrape:dlq": { depth: dlq.depth, lastHour: dlq.lastHour },
      },
      averageProcessingLatencyMs,
      lastSuccessfulRunBySource,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ module: "metrics", err: message }, "Metrics fetch failed");
    return res.status(500).json({ error: message });
  }
});

export default router;