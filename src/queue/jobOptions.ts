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
