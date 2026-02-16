import { createChildLogger } from '../logger.js';

const log = createChildLogger('telegram');

/**
 * Telegram Bot API를 통한 메시지 전송
 * - 큐 + 초당 1건 제한 (rate limit 준수)
 * - 전송 실패 시 로그만 남김 (알림 실패로 봇이 죽으면 안 됨)
 */
export class TelegramNotifier {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly queue: string[] = [];
  private processing = false;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  send(text: string): void {
    this.queue.push(text);
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const msg = this.queue.shift()!;
      try {
        await this.doSend(msg);
      } catch (err) {
        log.warn({ err }, 'Telegram send failed');
      }
      // 초당 1건 제한
      if (this.queue.length > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    this.processing = false;
  }

  private async doSend(text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.warn({ status: res.status, body }, 'Telegram API error');
    }
  }
}
