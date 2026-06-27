import { describe, it, expect, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: "<html><body>verify you are human</body></html>",
    }),
  },
}));

vi.mock("robots-parser", () => ({
  default: vi.fn().mockReturnValue({
    isAllowed: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock("../../src/workers/scrapers/booksScraperPlaywright", () => ({
  scrapeBooksFallback: vi.fn().mockResolvedValue([]),
}));

describe("booksScraper — fallback detection", () => {
  it("activa Playwright cuando la página contiene texto de CAPTCHA", async () => {
    const { scrapeBooks } = await import("../../src/workers/scrapers/booksScraper");
    const { scrapeBooksFallback } = await import("../../src/workers/scrapers/booksScraperPlaywright");

    await scrapeBooks();

    expect(scrapeBooksFallback).toHaveBeenCalledOnce();
  });
});