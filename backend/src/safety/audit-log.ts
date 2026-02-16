import { getDb } from '../db/database.js';
import type { TradingMode } from '../config.js';

/**
 * SQLite audit log — 모든 중요 이벤트 기록
 */
export class AuditLog {
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
  }

  log(
    level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    module: string,
    action: string,
    detail?: string,
    mode?: TradingMode,
  ): void {
    this.db.prepare(`
      INSERT INTO audit_log (timestamp, level, module, action, detail, mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Date.now(), level, module, action, detail ?? null, mode ?? null);
  }

  info(module: string, action: string, detail?: string, mode?: TradingMode): void {
    this.log('INFO', module, action, detail, mode);
  }

  warn(module: string, action: string, detail?: string, mode?: TradingMode): void {
    this.log('WARN', module, action, detail, mode);
  }

  error(module: string, action: string, detail?: string, mode?: TradingMode): void {
    this.log('ERROR', module, action, detail, mode);
  }

  critical(module: string, action: string, detail?: string, mode?: TradingMode): void {
    this.log('CRITICAL', module, action, detail, mode);
  }

  getRecent(limit: number = 50): Array<{
    id: number;
    timestamp: number;
    level: string;
    module: string;
    action: string;
    detail: string | null;
    mode: string | null;
  }> {
    return getDb()
      .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?')
      .all(limit) as Array<{
        id: number;
        timestamp: number;
        level: string;
        module: string;
        action: string;
        detail: string | null;
        mode: string | null;
      }>;
  }
}
