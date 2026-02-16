/**
 * 토큰 버킷 레이트 리미터
 * 빗썸 Private API: 초당 약 15회 (보수적으로 10/sec)
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;  // tokens/ms
  private lastRefill: number;

  constructor(maxPerSec: number = 10) {
    this.maxTokens = maxPerSec;
    this.tokens = maxPerSec;
    this.refillRate = maxPerSec / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // 토큰 없으면 대기
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitMs);
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
