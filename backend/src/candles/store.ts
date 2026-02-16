import type Database from 'better-sqlite3';
import { getDb } from '../db/database.js';
import { createChildLogger } from '../logger.js';
import type { Candle } from '../types/index.js';

const log = createChildLogger('candle-store');

/**
 * SQLite 캔들 스토어 — upsert + 조회 + 정합성 체크
 */
export class CandleStore {
  private db: Database.Database;
  private upsertStmt: Database.Statement;
  private selectRangeStmt: Database.Statement;
  private selectLatestStmt: Database.Statement;

  constructor() {
    this.db = getDb();
    this.upsertStmt = this.db.prepare(`
      INSERT INTO candles (timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(timestamp) DO UPDATE SET
        open   = excluded.open,
        high   = MAX(candles.high, excluded.high),
        low    = MIN(candles.low, excluded.low),
        close  = excluded.close,
        volume = excluded.volume
    `);
    this.selectRangeStmt = this.db.prepare(
      'SELECT * FROM candles WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    );
    this.selectLatestStmt = this.db.prepare(
      'SELECT * FROM candles ORDER BY timestamp DESC LIMIT ?',
    );
  }

  upsert(candle: Candle): void {
    this.upsertStmt.run(
      candle.timestamp,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
    );
  }

  upsertBatch(candles: Candle[]): void {
    const tx = this.db.transaction((items: Candle[]) => {
      for (const c of items) {
        this.upsertStmt.run(c.timestamp, c.open, c.high, c.low, c.close, c.volume);
      }
    });
    tx(candles);
    log.debug({ count: candles.length }, 'Batch upserted candles');
  }

  getRange(fromTs: number, toTs: number): Candle[] {
    return this.selectRangeStmt.all(fromTs, toTs) as Candle[];
  }

  getLatest(n: number): Candle[] {
    const rows = this.selectLatestStmt.all(n) as Candle[];
    return rows.reverse(); // 오래된 → 최신 순
  }

  /** 최근 n개 봉 중 최고가 (DCA 급락 판단용) */
  getMaxHigh(n: number): number {
    const rows = this.db.prepare(
      'SELECT MAX(t.high) as m FROM (SELECT high FROM candles ORDER BY timestamp DESC LIMIT ?) AS t',
    ).all(n) as { m: number | null }[];
    const v = rows[0]?.m;
    return typeof v === 'number' ? v : 0;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM candles').get() as { cnt: number };
    return row.cnt;
  }

  /**
   * REST 캔들과 비교하여 정합성 체크
   * 불일치 시 REST 데이터로 덮어쓰기
   * @returns 수정된 봉 수
   */
  reconcile(restCandles: Candle[]): number {
    let fixedCount = 0;
    const tx = this.db.transaction((candles: Candle[]) => {
      for (const rc of candles) {
        const local = this.db.prepare(
          'SELECT * FROM candles WHERE timestamp = ?',
        ).get(rc.timestamp) as Candle | undefined;

        if (!local) {
          // 누락된 봉 삽입
          this.upsertStmt.run(rc.timestamp, rc.open, rc.high, rc.low, rc.close, rc.volume);
          fixedCount++;
        } else if (
          Math.abs(local.close - rc.close) > 1 ||
          Math.abs(local.high - rc.high) > 1 ||
          Math.abs(local.low - rc.low) > 1
        ) {
          // 가격 불일치 → REST 기준으로 덮어쓰기
          this.db.prepare(`
            UPDATE candles SET open=?, high=?, low=?, close=?, volume=?
            WHERE timestamp=?
          `).run(rc.open, rc.high, rc.low, rc.close, rc.volume, rc.timestamp);
          fixedCount++;
          log.warn(
            { ts: rc.timestamp, localClose: local.close, restClose: rc.close },
            'Candle reconciled',
          );
        }
      }
    });
    tx(restCandles);
    if (fixedCount > 0) {
      log.info({ fixedCount }, 'Reconciliation complete');
    }
    return fixedCount;
  }
}
