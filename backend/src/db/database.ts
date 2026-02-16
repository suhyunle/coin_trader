import Database from 'better-sqlite3';
import { config } from '../config.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(config.db.path);
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    initSchema(_db);
    log.info({ path: config.db.path }, 'Database initialized');
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candles (
      timestamp INTEGER PRIMARY KEY,
      open      REAL NOT NULL,
      high      REAL NOT NULL,
      low       REAL NOT NULL,
      close     REAL NOT NULL,
      volume    REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mode        TEXT NOT NULL,
      entry_time  INTEGER NOT NULL,
      exit_time   INTEGER,
      entry_price REAL NOT NULL,
      exit_price  REAL,
      qty         REAL NOT NULL,
      pnl         REAL,
      pnl_pct     REAL,
      stop_loss   REAL,
      reason      TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      mode        TEXT NOT NULL,
      side        TEXT NOT NULL,
      type        TEXT NOT NULL,
      price       REAL NOT NULL,
      qty         REAL NOT NULL,
      status      TEXT NOT NULL,
      bithumb_id  TEXT,
      error       TEXT,
      created_at  INTEGER NOT NULL,
      filled_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      level      TEXT NOT NULL,
      module     TEXT NOT NULL,
      action     TEXT NOT NULL,
      detail     TEXT,
      mode       TEXT
    );

    CREATE TABLE IF NOT EXISTS equity_snapshots (
      timestamp INTEGER PRIMARY KEY,
      equity    REAL NOT NULL,
      mode      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_candles_ts ON candles(timestamp);
    CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(mode);
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp);
  `);
}
