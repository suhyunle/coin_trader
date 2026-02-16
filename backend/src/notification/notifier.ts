import { config } from '../config.js';
import { createChildLogger } from '../logger.js';
import { TelegramNotifier } from './telegram.js';

const log = createChildLogger('notifier');

/**
 * 알림 허브 — TelegramNotifier 래핑 + 이벤트별 메시지 포맷
 * enabled=false이면 모든 호출 무시
 */
export class Notifier {
  private readonly tg: TelegramNotifier | null;

  constructor() {
    if (config.telegram.enabled && config.telegram.botToken && config.telegram.chatId) {
      this.tg = new TelegramNotifier(config.telegram.botToken, config.telegram.chatId);
      log.info('Telegram notifier enabled');
    } else {
      this.tg = null;
      log.debug('Telegram notifier disabled');
    }
  }

  notifyEntry(price: number, qty: number, stopLoss: number): void {
    this.send(
      `📈 <b>매수 체결</b>\n` +
      `가격: ${price.toLocaleString()} KRW\n` +
      `수량: ${qty} BTC\n` +
      `손절: ${stopLoss.toLocaleString()} KRW`,
    );
  }

  notifyExit(price: number, qty: number, pnl: number, reason: string): void {
    const emoji = pnl >= 0 ? '💰' : '📉';
    this.send(
      `${emoji} <b>매도 체결</b>\n` +
      `가격: ${price.toLocaleString()} KRW\n` +
      `수량: ${qty} BTC\n` +
      `손익: ${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()} KRW\n` +
      `사유: ${reason}`,
    );
  }

  notifyKillSwitch(reason: string): void {
    this.send(`🚨 <b>킬스위치 발동</b>\n사유: ${reason}`);
  }

  notifyError(module: string, message: string): void {
    this.send(`⚠️ <b>에러</b> [${module}]\n${message}`);
  }

  notifyWsState(state: string): void {
    if (state === 'RECONNECTING') {
      this.send('🔌 WebSocket 연결 끊김 — 재연결 시도 중');
    } else if (state === 'CONNECTED') {
      this.send('✅ WebSocket 연결 복구');
    }
  }

  notifyStartup(mode: string): void {
    this.send(`🤖 <b>봇 시작</b>\n모드: ${mode}`);
  }

  notifyShutdown(): void {
    this.send('🛑 <b>봇 종료</b>');
  }

  private send(text: string): void {
    if (!this.tg) return;
    try {
      this.tg.send(text);
    } catch (err) {
      log.warn({ err }, 'Notifier send error');
    }
  }
}
