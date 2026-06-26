import { Request, Response, NextFunction } from "express";
import logger from "../../logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      module: "http",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    }, `${req.method} ${req.path} ${res.statusCode}`);
  });

  next();
}