import dotenv from "dotenv";
dotenv.config();

import app from "./api/server";
import { startScheduler } from "./scheduler";
import { startScraperWorker } from "./workers/scraperWorker";
import { startTransformerWorker } from "./transformer/transformerWorker";
import { startPersisterWorker } from "./persister/persisterWorker";
import db from "./db/client";
import logger from "./logger";

const PORT = process.env.PORT || 3000;

let shutdownFn: (() => Promise<void>) | null = null;

process.on("unhandledRejection", async (reason) => {
  logger.error({ module: "index", reason }, "Unhandled rejection");
  if (shutdownFn) await shutdownFn();
  else process.exit(1);
});

process.on("uncaughtException", async (err) => {
  logger.error({ module: "index", err: err.message }, "Uncaught exception");
  if (shutdownFn) await shutdownFn();
  else process.exit(1);
});

async function main() {
  const scraperWorker = startScraperWorker();
  const transformerWorker = startTransformerWorker();
  const persisterWorker = startPersisterWorker();
  startScheduler();

  const server = app.listen(PORT, () => {
    logger.info({ module: "index" }, `Server running on port ${PORT}`);
  });

  shutdownFn = async () => {
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

    await db.destroy();
    logger.info({ module: "index" }, "Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdownFn);
  process.on("SIGINT", shutdownFn);
}

main();