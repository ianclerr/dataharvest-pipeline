import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { pendingQueue, rawQueue, processedQueue, dlqQueue } from "../../queue/queues";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(pendingQueue),
    new BullMQAdapter(rawQueue),
    new BullMQAdapter(processedQueue),
    new BullMQAdapter(dlqQueue),
  ],
  serverAdapter,
});

export default serverAdapter;