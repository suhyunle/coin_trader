import { readFileSync } from 'node:fs';
import type { Candle } from '../types/index.js';

export interface CsvLoaderOptions {
  readonly timestampCol?: string;
  readonly openCol?: string;
  readonly highCol?: string;
  readonly lowCol?: string;
  readonly closeCol?: string;
  readonly volumeCol?: string;
}

const DEFAULTS: Required<CsvLoaderOptions> = {
  timestampCol: 'timestamp',
  openCol: 'open',
  highCol: 'high',
  lowCol: 'low',
  closeCol: 'close',
  volumeCol: 'volume',
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseTimestamp(value: string): number {
  const num = Number(value);
  if (!Number.isNaN(num)) {
    // seconds → ms 변환 (10자리 이하면 초 단위로 간주)
    return value.length <= 10 ? num * 1000 : num;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return ms;
}

function validateCandle(c: Candle, lineNum: number): void {
  if (c.high < c.low) {
    throw new Error(`Line ${lineNum}: high (${c.high}) < low (${c.low})`);
  }
  if (c.close < 0 || c.open < 0) {
    throw new Error(`Line ${lineNum}: negative price`);
  }
  if (c.volume < 0) {
    throw new Error(`Line ${lineNum}: negative volume`);
  }
}

export function loadCsv(
  filePath: string,
  options?: CsvLoaderOptions,
): Candle[] {
  const opts = { ...DEFAULTS, ...options };
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must have header + at least 1 data row');
  }

  const header = parseCsvLine(lines[0]!);
  const colIndex = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx === -1) {
      throw new Error(`Column "${name}" not found. Available: ${header.join(', ')}`);
    }
    return idx;
  };

  const ti = colIndex(opts.timestampCol);
  const oi = colIndex(opts.openCol);
  const hi = colIndex(opts.highCol);
  const li = colIndex(opts.lowCol);
  const ci = colIndex(opts.closeCol);
  const vi = colIndex(opts.volumeCol);

  const candles: Candle[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]!);
    const candle: Candle = {
      timestamp: parseTimestamp(fields[ti] ?? ''),
      open: Number(fields[oi]),
      high: Number(fields[hi]),
      low: Number(fields[li]),
      close: Number(fields[ci]),
      volume: Number(fields[vi]),
    };
    validateCandle(candle, i + 1);
    candles.push(candle);
  }

  // 시간순 정렬
  candles.sort((a, b) => a.timestamp - b.timestamp);

  // 중복 타임스탬프 확인
  for (let i = 1; i < candles.length; i++) {
    if (candles[i]!.timestamp === candles[i - 1]!.timestamp) {
      throw new Error(`Duplicate timestamp: ${candles[i]!.timestamp}`);
    }
  }

  return candles;
}
