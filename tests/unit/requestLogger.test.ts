import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { Request, Response, NextFunction } from "express";
import { requestLogger } from "../../src/api/middleware/requestLogger";
import logger from "../../src/logger";

function createMockRes(statusCode: number) {
  const res = new EventEmitter() as unknown as Response;
  (res as unknown as { statusCode: number }).statusCode = statusCode;
  return res;
}

describe("requestLogger middleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls next() synchronously so the request is not blocked", () => {
    const req = { method: "GET", path: "/api/v1/books" } as Request;
    const res = createMockRes(200);
    const next = vi.fn() as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("logs method, path, status, and duration when the response finishes", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    const req = { method: "POST", path: "/api/v1/jobs/trigger" } as Request;
    const res = createMockRes(201);
    const next = vi.fn() as NextFunction;

    requestLogger(req, res, next);
    res.emit("finish");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [meta, message] = infoSpy.mock.calls[0];
    expect(meta).toMatchObject({
      module: "http",
      method: "POST",
      path: "/api/v1/jobs/trigger",
      status: 201,
    });
    expect(typeof (meta as { durationMs: number }).durationMs).toBe("number");
    expect(message).toBe("POST /api/v1/jobs/trigger 201");
  });

  it("does not log before the response finishes", () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    const req = { method: "GET", path: "/api/v1/health" } as Request;
    const res = createMockRes(200);
    const next = vi.fn() as NextFunction;

    requestLogger(req, res, next);

    expect(infoSpy).not.toHaveBeenCalled();
  });
});
