import { describe, it, expect } from "vitest";
import {
  scraperBackoffDelay,
  SCRAPER_BACKOFF_BASE_MS,
  SCRAPER_BACKOFF_MAX_MS,
} from "../../src/queue/jobOptions";

describe("scraperBackoffDelay", () => {
  it("uses exponential backoff from base delay", () => {
    expect(scraperBackoffDelay(1)).toBe(SCRAPER_BACKOFF_BASE_MS);
    expect(scraperBackoffDelay(2)).toBe(SCRAPER_BACKOFF_BASE_MS * 2);
    expect(scraperBackoffDelay(3)).toBe(SCRAPER_BACKOFF_BASE_MS * 4);
  });

  it("caps delay at 30 seconds", () => {
    expect(scraperBackoffDelay(5)).toBe(SCRAPER_BACKOFF_MAX_MS);
    expect(scraperBackoffDelay(10)).toBe(SCRAPER_BACKOFF_MAX_MS);
  });
});
