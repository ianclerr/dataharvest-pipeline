import dotenv from "dotenv";
dotenv.config();

import app from "./api/server";
import { startScheduler } from "./scheduler";
import { startScraperWorker } from "./workers/scraperWorker";
import { startTransformerWorker } from "./transformer/transformerWorker";
import { startPersisterWorker } from "./persister/persisterWorker";
import db from "./db/client";
import logger from "./logger";

process.on("unhandledRejection", (reason) => {
  logger.error({ module: "index", reason }, "Unhandled rejection");
  console.error("FULL ERROR:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error({ module: "index", err: err.message }, "Uncaught exception");
  process.exit(1);
});

const PORT = process.env.PORT || 3000;

async function main() {
  const scraperWorker = startScraperWorker();
  const transformerWorker = startTransformerWorker();
  const persisterWorker = startPersisterWorker();
  startScheduler();

  const server = app.listen(PORT, () => {
    logger.info({ module: "index" }, `Server running on port ${PORT}`);
  });

  async function shutdown() {
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
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();