import { Router } from "express";
import { sseEmitter } from "../../events/sseEmitter";

const router = Router();

router.get("/", (req, res) => {
  const filterType = req.query.type as string | undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); 
  res.flushHeaders();


  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 30_000);

  // evento inicial de confirmación
  res.write(`event: connected\ndata: ${JSON.stringify({ filter: filterType ?? "all" })}\n\n`);

  const onEvent = (event: any) => {
    if (filterType && event.type !== filterType) return;
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  sseEmitter.on("event", onEvent);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseEmitter.off("event", onEvent);
  });
});

export default router;