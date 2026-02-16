import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/execution/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow immediate requests under limit', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();

    // 10 requests should be instant
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // should be near-instant
  });

  it('should throttle when tokens exhausted', async () => {
    const limiter = new RateLimiter(5);

    // Exhaust tokens
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const start = Date.now();
    await limiter.acquire(); // should wait
    const elapsed = Date.now() - start;

    // Should wait at least some time for token refill
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
