import { Router } from "express";
import { createClient } from "redis";
import db from "../../db/client";
import { pendingQueue, rawQueue, processedQueue } from "../../queue/queues";
import logger from "../../logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await db.raw("SELECT 1");

    const client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    await client.connect();
    await client.ping();
    await client.disconnect();

    const [pending, raw, processed] = await Promise.all([
      pendingQueue.getJobCounts(),
      rawQueue.getJobCounts(),
      processedQueue.getJobCounts(),
    ]);

    return res.json({
      status: "ok",
      db: "connected",
      redis: "connected",
      queues: {
        "scrape:pending": pending,
        "scrape:raw": raw,
        "scrape:processed": processed,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ module: "health", err: message }, "Health check failed");
    return res.status(503).json({ status: "error", error: message });
  }
});

export default router;