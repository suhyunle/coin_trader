import * as jose from 'jose';
import { randomUUID } from 'node:crypto';

/**
 * 빗썸 Private API JWT (HS256)
 * Payload: access_key, nonce (UUID), timestamp (ms). 매 요청마다 nonce 새로 생성.
 */
export async function createBithumbJwt(
  accessKey: string,
  secretKey: string,
): Promise<string> {
  const secret = new TextEncoder().encode(secretKey);
  return await new jose.SignJWT({
    access_key: accessKey,
    nonce: randomUUID(),
    timestamp: Date.now(),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);
}
