import { createHmac } from 'node:crypto';
import { config } from '../config.js';

/**
 * 빗썸 Private API JWT HS256 인증 토큰 생성
 *
 * Header: {"alg":"HS256","typ":"JWT"}
 * Payload: { access_key, nonce, timestamp }
 * Signature: HMAC-SHA256(header.payload, secret_key)
 */
export function createAuthToken(
  accessKey?: string,
  secretKey?: string,
): string {
  const ak = accessKey ?? config.bithumb.accessKey;
  const sk = secretKey ?? config.bithumb.secretKey;

  if (!ak || !sk) {
    throw new Error('Bithumb API keys not configured');
  }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    access_key: ak,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  }));

  const signature = base64url(
    createHmac('sha256', sk)
      .update(`${header}.${payload}`)
      .digest(),
  );

  return `${header}.${payload}.${signature}`;
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}
