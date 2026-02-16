import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { request as undiciRequest } from 'undici';
import { createChildLogger } from '../../logger.js';
import { config } from '../../config.js';
import { BITHUMB_REST_BASE } from './endpoints.js';
import { createBithumbJwt } from './auth.js';
import type { z } from 'zod';

const log = createChildLogger('bithumb-client');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = config.execution.maxRetries;
const RETRY_BASE_MS = 1000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * raw 응답을 로그 및 파일로 덤프 (zod 실패 시 디버깅용)
 */
function dumpRaw(endpoint: string, raw: unknown): void {
  const payload = JSON.stringify(raw, null, 2);
  log.warn({ endpoint, rawLength: payload.length }, 'Response validation failed; raw dump');
  try {
    const dumpDir = join(process.cwd(), 'data');
    mkdirSync(dumpDir, { recursive: true });
    const file = join(dumpDir, `bithumb-raw-${Date.now()}-${endpoint.replace(/\//g, '_')}.json`);
    writeFileSync(file, payload, 'utf8');
    log.warn({ file }, 'Raw response written to file');
  } catch (e) {
    log.warn({ err: e }, 'Could not write raw dump file');
  }
}

/**
 * Public GET — URL은 endpoints 상수만 사용. 429/5xx/timeout 재시도(지수 백오프).
 */
export async function requestPublic<T>(
  path: string,
  query: Record<string, string> = {},
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const url = new URL(path, BITHUMB_REST_BASE);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { statusCode, body } = await undiciRequest(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        bodyTimeout: timeout,
        headersTimeout: timeout,
      });

      const raw = (await body.json()) as unknown;

      if (isAuthError(statusCode)) {
        log.error({ statusCode, path }, 'Auth error — check API keys (401/403)');
        throw new Error(`Bithumb API auth error: ${statusCode}. 설정 오류로 분류.`);
      }
      if (statusCode !== 200) {
        if (isRetryableStatus(statusCode) && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          log.warn({ statusCode, attempt, delay }, 'Retryable error, backing off');
          await sleep(delay);
          continue;
        }
        log.warn({ statusCode, raw }, 'Public request failed');
        return raw as T;
      }
      return raw as T;
    } catch (err) {
      lastError = err as Error;
      const isTimeout =
        lastError.name === 'TimeoutError' ||
        (lastError as { code?: string }).code === 'UND_ERR_HEADERS_TIMEOUT' ||
        (lastError as { code?: string }).code === 'UND_ERR_BODY_TIMEOUT';
      if (isTimeout && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        log.warn({ attempt, delay }, 'Timeout, retrying');
        await sleep(delay);
        continue;
      }
      if (attempt < MAX_RETRIES) {
        log.warn({ attempt, err }, 'Request failed, retrying');
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error('Public request failed after retries');
}

/**
 * Public GET + zod 검증. 실패 시 raw 덤프 후 throw.
 */
export async function requestPublicValidated<T>(
  path: string,
  query: Record<string, string>,
  schema: z.ZodType<T>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const raw = await requestPublic<unknown>(path, query, options);
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  dumpRaw(path, raw);
  throw new Error(`Bithumb response validation failed: ${result.error.message}`);
}

/**
 * Private 요청 — Authorization: Bearer <JWT>, JWT는 매 요청 새로 생성.
 * 401/403 즉시 중단(설정 오류). 429/5xx/timeout 재시도.
 */
export async function requestPrivate(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, string>;
    timeoutMs?: number;
  },
): Promise<unknown> {
  const url = new URL(path, BITHUMB_REST_BASE);
  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const timeout = options.timeoutMs ?? config.execution.orderTimeoutMs;
  const token = await createBithumbJwt(config.bithumb.accessKey, config.bithumb.secretKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  let body: string | undefined;
  if (options.body && Object.keys(options.body).length > 0) {
    body = new URLSearchParams(options.body).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await undiciRequest(url.toString(), {
        method: options.method,
        headers,
        body,
        bodyTimeout: timeout,
        headersTimeout: timeout,
      });
      const raw = (await res.body.json()) as { status?: string; message?: string; data?: unknown };

      if (res.statusCode === 401 || res.statusCode === 403) {
        log.error({ statusCode: res.statusCode, path }, 'Private API auth error — 즉시 중단');
        throw new Error(`Bithumb Private API auth error: ${res.statusCode}. 설정 오류로 분류.`);
      }
      if (res.statusCode === 429 || res.statusCode >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          log.warn({ statusCode: res.statusCode, attempt, delay }, 'Retryable, backing off');
          await sleep(delay);
          continue;
        }
      }
      if (res.statusCode !== 200) {
        log.warn({ statusCode: res.statusCode, raw }, 'Private request failed');
        return raw;
      }
      return raw;
    } catch (err) {
      lastError = err as Error;
      if (err instanceof Error && err.message.includes('설정 오류')) throw err;
      const isTimeout =
        lastError.name === 'TimeoutError' ||
        (lastError as { code?: string }).code === 'UND_ERR_HEADERS_TIMEOUT' ||
        (lastError as { code?: string }).code === 'UND_ERR_BODY_TIMEOUT';
      if (isTimeout && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error('Private request failed after retries');
}

/**
 * Private + zod 검증. 실패 시 raw 덤프 후 throw.
 */
export async function requestPrivateValidated<T>(
  path: string,
  options: { method: 'GET' | 'POST' | 'DELETE'; query?: Record<string, string>; body?: Record<string, string> },
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await requestPrivate(path, options);
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  dumpRaw(path, raw);
  throw new Error(`Bithumb private response validation failed: ${result.error.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
