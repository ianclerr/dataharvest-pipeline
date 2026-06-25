import { Queue } from "bullmq";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

export const pendingQueue = new Queue("scrape-pending", { connection });
export const rawQueue = new Queue("scrape-raw", { connection });
export const processedQueue = new Queue("scrape-processed", { connection });
export const dlqQueue = new Queue("scrape-dlq", { connection });

export default { pendingQueue, rawQueue, processedQueue, dlqQueue };