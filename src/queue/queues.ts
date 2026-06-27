import { Queue } from "bullmq";

export const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

// Límites de retención para no acumular miles de jobs en Redis indefinidamente
const defaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const pendingQueue = new Queue("scrape-pending", { connection, defaultJobOptions });
export const rawQueue = new Queue("scrape-raw", { connection, defaultJobOptions });
export const processedQueue = new Queue("scrape-processed", { connection, defaultJobOptions });
// La DLQ no usa límites — queremos conservar todos los jobs fallidos para inspección manual
export const dlqQueue = new Queue("scrape-dlq", { connection });
