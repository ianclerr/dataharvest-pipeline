export const SCRAPER_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
};

export const TRANSFORMER_JOB_OPTS = {
  attempts: 2,
};

export const PERSISTER_JOB_OPTS = {
  attempts: 5,
  backoff: { type: "fixed" as const, delay: 5000 },
};

export const SCRAPER_BACKOFF_BASE_MS = 2000;
export const SCRAPER_BACKOFF_MAX_MS = 30000;

export function scraperBackoffDelay(attemptsMade: number): number {
  return Math.min(
    SCRAPER_BACKOFF_BASE_MS * Math.pow(2, attemptsMade - 1),
    SCRAPER_BACKOFF_MAX_MS
  );
}
