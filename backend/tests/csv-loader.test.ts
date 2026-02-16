import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadCsv } from '../src/data/csv-loader.js';

const TMP_DIR = join(import.meta.dirname ?? '.', '__tmp__');

function setup() {
  mkdirSync(TMP_DIR, { recursive: true });
}

function teardown() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function writeTmp(name: string, content: string): string {
  const p = join(TMP_DIR, name);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('csv-loader', () => {
  it('should parse basic CSV', () => {
    setup();
    try {
      const path = writeTmp('test.csv', [
        'timestamp,open,high,low,close,volume',
        '1700000000,100,110,90,105,1000',
        '1700000300,105,115,95,110,2000',
      ].join('\n'));

      const candles = loadCsv(path);
      expect(candles).toHaveLength(2);
      expect(candles[0]!.open).toBe(100);
      expect(candles[0]!.timestamp).toBe(1700000000000); // seconds → ms
      expect(candles[1]!.volume).toBe(2000);
    } finally {
      teardown();
    }
  });

  it('should sort by timestamp', () => {
    setup();
    try {
      const path = writeTmp('unsorted.csv', [
        'timestamp,open,high,low,close,volume',
        '1700000300,105,115,95,110,2000',
        '1700000000,100,110,90,105,1000',
      ].join('\n'));

      const candles = loadCsv(path);
      expect(candles[0]!.timestamp).toBeLessThan(candles[1]!.timestamp);
    } finally {
      teardown();
    }
  });

  it('should reject high < low', () => {
    setup();
    try {
      const path = writeTmp('bad.csv', [
        'timestamp,open,high,low,close,volume',
        '1700000000,100,80,90,105,1000',
      ].join('\n'));

      expect(() => loadCsv(path)).toThrow('high');
    } finally {
      teardown();
    }
  });

  it('should reject duplicate timestamps', () => {
    setup();
    try {
      const path = writeTmp('dup.csv', [
        'timestamp,open,high,low,close,volume',
        '1700000000,100,110,90,105,1000',
        '1700000000,105,115,95,110,2000',
      ].join('\n'));

      expect(() => loadCsv(path)).toThrow('Duplicate');
    } finally {
      teardown();
    }
  });
});
