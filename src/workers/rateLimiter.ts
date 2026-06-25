export class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private delayMs: number;

  constructor(delayMs?: number) {
    this.delayMs = delayMs || Number(process.env.RATE_LIMIT_DELAY_MS) || 1000;
  }

  async throttle(host: string): Promise<void> {
    const last = this.lastRequestTime.get(host) || 0;
    const now = Date.now();
    const elapsed = now - last;

    if (elapsed < this.delayMs) {
      const wait = this.delayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    this.lastRequestTime.set(host, Date.now());
  }
}   