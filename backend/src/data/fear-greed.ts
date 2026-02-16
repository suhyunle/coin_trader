import { createChildLogger } from '../logger.js';
import { config } from '../config.js';

const log = createChildLogger('fear-greed');

/** 공포탐욕지수 0~100 (0=극도공포, 100=극도탐욕) */
let cachedValue: number = 50;
let cachedAt: number = 0;

const CACHE_MS = (config.fearGreedCacheMinutes ?? 60) * 60 * 1000;
const API_URL = process.env.FEAR_GREED_API_URL ?? 'https://api.alternative.me/fng/?limit=1';

export function getFearGreed(): number {
  return cachedValue;
}

export function getFearGreedCachedAt(): number {
  return cachedAt;
}

/**
 * 외부 API에서 공포탐욕지수 fetch 후 캐시
 * Alternative.me 형식: { data: [ { value: "25", value_classification: "Extreme Fear" } ] }
 */
export async function fetchAndCacheFearGreed(): Promise<number> {
  if (Date.now() - cachedAt < CACHE_MS) {
    return cachedValue;
  }
  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ value?: string }> };
    const valueStr = json.data?.[0]?.value;
    if (valueStr != null) {
      const v = parseInt(valueStr, 10);
      if (!Number.isNaN(v) && v >= 0 && v <= 100) {
        cachedValue = v;
        cachedAt = Date.now();
        log.debug({ value: cachedValue }, 'Fear & Greed cached');
        return cachedValue;
      }
    }
  } catch (err) {
    log.debug({ err }, 'Fear & Greed fetch failed, using cache');
  }
  return cachedValue;
}
