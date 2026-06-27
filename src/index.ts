import dotenv from "dotenv";
dotenv.config();

import app from "./api/server";
import { startScheduler } from "./scheduler";
import { startScraperWorker } from "./workers/scraperWorker";
import { startTransformerWorker } from "./transformer/transformerWorker";
import { startPersisterWorker } from "./persister/persisterWorker";
import { pendingQueue, rawQueue, processedQueue, dlqQueue } from "./queue/queues";
import db from "./db/client";
import logger from "./logger";

const PORT = process.env.PORT || 3000;

async function main() {
  const scraperWorker = startScraperWorker();
  const transformerWorker = startTransformerWorker();
  const persisterWorker = startPersisterWorker();
  startScheduler();

  const server = app.listen(PORT, () => {
    logger.info({ module: "index" }, `Server running on port ${PORT}`);
  });

  // shutdownFn se asigna ANTES de registrar los handlers de proceso (SIGTERM,
  // unhandledRejection, uncaughtException), para evitar la race condition en
  // la que un error durante el arranque encuentra shutdownFn === null y el
  // proceso sale sin cerrar nada limpiamente.
  const shutdownFn = async () => {
    logger.info({ module: "index" }, "Shutting down...");

    server.close();

    await Promise.race([
      Promise.all([
        scraperWorker.close(),
        transformerWorker.close(),
        persisterWorker.close(),
      ]),
      new Promise((resolve) => setTimeout(resolve, 30000)),
    ]);

    // Cerrar también las instancias de Queue (no solo los Workers) para
    // liberar las conexiones TCP a Redis que mantienen abiertas
    await Promise.all([
      pendingQueue.close(),
      rawQueue.close(),
      processedQueue.close(),
      dlqQueue.close(),
    ]);

    await db.destroy();
    logger.info({ module: "index" }, "Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdownFn);
  process.on("SIGINT", shutdownFn);

  process.on("unhandledRejection", async (reason) => {
    logger.error({ module: "index", reason }, "Unhandled rejection");
    await shutdownFn();
  });

  process.on("uncaughtException", async (err) => {
    logger.error({ module: "index", err: err.message }, "Uncaught exception");
    await shutdownFn();
  });
}

main();
