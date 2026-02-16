import * as jose from 'jose';
import { createHash, randomUUID } from 'node:crypto';

/** env: true면 Secret을 문자열 그대로(UTF-8) 사용. false 또는 미설정이면 base64 형태일 때 디코딩 */
const SECRET_RAW = process.env.BITHUMB_SECRET_RAW === 'true';

/**
 * 빗썸 Secret Key. 발급이 base64 문자열인 경우가 많아, 그럴 때는 디코딩 후 서명.
 * 401 jwt_verification 시 BITHUMB_SECRET_RAW=true 로 문자열 그대로 시도.
 */
function secretKeyBytes(secretKey: string): Uint8Array {
  const trimmed = secretKey.trim();
  if (SECRET_RAW) return new TextEncoder().encode(secretKey);
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 32) {
    try {
      const decoded = Buffer.from(trimmed, 'base64');
      if (decoded.length > 0) return new Uint8Array(decoded);
    } catch {
      /* ignore */
    }
  }
  return new TextEncoder().encode(secretKey);
}

/**
 * Private API JWT (HS256) — 빗썸 규격.
 * GET/POST 파라미터가 있으면 query_hash(SHA512), query_hash_alg 필수.
 */
export async function createBithumbJwt(
  accessKey: string,
  secretKey: string,
  options?: { queryHash?: string },
): Promise<string> {
  const secret = secretKeyBytes(secretKey);
  const payload: Record<string, string | number> = {
    access_key: accessKey,
    nonce: randomUUID(),
    timestamp: Date.now(),
  };
  if (options?.queryHash) {
    payload.query_hash = options.queryHash;
    payload.query_hash_alg = 'SHA512';
  }
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);
}

/** 정렬된 키로 query string → SHA512 (소문자 hex). GET 쿼리용 */
export function sha512QueryString(body: Record<string, string>): string {
  const qs = Object.keys(body)
    .sort()
    .map((k) => `${k}=${body[k]}`)
    .join('&');
  return createHash('sha512').update(qs).digest('hex').toLowerCase();
}

/** 키 삽입 순서 유지 query string → SHA512. POST body용(빗썸: JSON 키 순서와 동일해야 함) */
export function sha512QueryStringFromBody(body: Record<string, string>): string {
  const qs = Object.entries(body)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return createHash('sha512').update(qs).digest('hex').toLowerCase();
}
