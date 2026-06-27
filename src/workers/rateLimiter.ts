export class RateLimiter {
  private tokens: Map<string, number> = new Map();
  private lastRefill: Map<string, number> = new Map();
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(requestsPerInterval: number = 1, intervalMs: number = 1000) {
    this.maxTokens = requestsPerInterval;
    this.refillIntervalMs = intervalMs;
  }

  async throttle(host: string): Promise<void> {
    const now = Date.now();

    // ✅ Inicializar primero si es la primera vez que se ve este host
    if (!this.tokens.has(host)) {
      this.tokens.set(host, this.maxTokens);
      this.lastRefill.set(host, now);
    }

    // Reponer tokens según tiempo transcurrido desde último refill
    const last = this.lastRefill.get(host)!;
    const elapsed = now - last;
    const refills = Math.floor(elapsed / this.refillIntervalMs);

    if (refills > 0) {
      const current = this.tokens.get(host)!;
      this.tokens.set(host, Math.min(this.maxTokens, current + refills));
      this.lastRefill.set(host, last + refills * this.refillIntervalMs);
    }

    // Consumir un token o esperar hasta que haya uno disponible
    const available = this.tokens.get(host)!;
    if (available <= 0) {
      const nextRefillIn =
        this.refillIntervalMs - (now - this.lastRefill.get(host)!);
      await new Promise((res) => setTimeout(res, Math.max(0, nextRefillIn)));
      return this.throttle(host);
    }

    this.tokens.set(host, available - 1);
  }
}