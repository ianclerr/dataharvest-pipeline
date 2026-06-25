import { Router } from "express";
import { pendingQueue, rawQueue, processedQueue, dlqQueue } from "../../queue/queues";
import db from "../../db/client";
import { createClient } from "redis";
import logger from "../../logger";

const router = Router();

// GET /api/v1/metrics
router.get("/", async (req, res) => {
  try {
    const [pending, raw, processed, dlq] = await Promise.all([
      pendingQueue.getJobCounts(),
      rawQueue.getJobCounts(),
      processedQueue.getJobCounts(),
      dlqQueue.getJobCounts(),
    ]);

    return res.json({
      queues: {
        "scrape:pending": pending,
        "scrape:raw": raw,
        "scrape:processed": processed,
        "scrape:dlq": dlq,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/health
router.get("/health", async (req, res) => {
  try {
    await db.raw("SELECT 1");

    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    await client.ping();
    await client.disconnect();

    return res.json({ status: "ok", db: "connected", redis: "connected" });
  } catch (err: any) {
    logger.error({ module: "health", err: err.message }, "Health check failed");
    return res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;