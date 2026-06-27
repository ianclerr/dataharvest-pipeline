import { Router } from "express";
import Redis from "ioredis";
import db from "../../db/client";
import { pendingQueue, rawQueue, processedQueue, connection } from "../../queue/queues";
import logger from "../../logger";

const router = Router();

// Usamos ioredis directamente en lugar de (queue as any).client.ping(),
// que accede a internals no documentados de BullMQ y puede romperse entre versiones.
const redisClient = new Redis(connection.url);

// Sin este listener, ioredis cae a su propio fallback de consola (no estructurado)
// cada vez que la conexión falla; lo enrutamos al logger para mantener logs consistentes.
redisClient.on("error", (err) => {
  logger.error({ module: "health", err: err.message }, "Redis health-check client error");
});

router.get("/", async (_req, res) => {
  try {
    await db.raw("SELECT 1");
    await redisClient.ping();

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
