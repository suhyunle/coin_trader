import { describe, it, expect } from 'vitest';
import { createAuthToken } from '../src/execution/auth.js';

describe('createAuthToken', () => {
  it('should generate valid JWT format', () => {
    const token = createAuthToken('test_access_key', 'test_secret_key');

    // JWT has 3 parts separated by dots
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Decode header
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');

    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
    expect(payload.access_key).toBe('test_access_key');
    expect(payload.nonce).toBeDefined();
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it('should generate unique tokens (different nonce)', () => {
    const t1 = createAuthToken('key', 'secret');
    const t2 = createAuthToken('key', 'secret');
    expect(t1).not.toBe(t2);
  });

  it('should throw without keys', () => {
    expect(() => createAuthToken('', 'secret')).toThrow('not configured');
    expect(() => createAuthToken('key', '')).toThrow('not configured');
  });
});
