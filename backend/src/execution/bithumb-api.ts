import { RateLimiter } from './rate-limiter.js';
import { createChildLogger } from '../logger.js';
import * as bithumb from '../exchange/bithumb/rest.js';

const log = createChildLogger('bithumb-api');

export interface BithumbOrderResult {
  orderId: string;
  status: 'success' | 'error';
  message?: string;
}

export interface BithumbBalance {
  totalKrw: number;
  availableKrw: number;
  totalBtc: number;
  availableBtc: number;
}

export interface BithumbOrderInfo {
  orderId: string;
  side: 'bid' | 'ask';
  type: string;
  price: number;
  qty: number;
  status: string;
  filledQty: number;
  /** 시장가 매수(price) 시 주문 금액(KRW); filledQty와 함께 평균체결가 계산 가능 */
  executedVolume?: number;
}

/** GET /v1/orders 목록 항목 (state: wait | watch | done | cancel) */
export interface BithumbOrderListItem {
  uuid: string;
  side: string;
  ord_type: string;
  price: string;
  state: string;
  volume: string;
  executed_volume: string;
  created_at?: string;
}

/**
 * 빗썸 v1 Private REST API 클라이언트
 *
 * 엔드포인트:
 *   POST /v1/orders          — 주문 생성
 *   DELETE /v1/order          — 주문 취소
 *   GET /v1/order             — 개별 주문 조회
 *   GET /v1/orders            — 주문 리스트
 *   GET /v1/accounts          — 전체 계좌(잔고) 조회
 *   GET /v1/orders/chance     — 주문 가능 정보
 *
 * 인증: JWT HS256 (exchange/bithumb/auth.ts)
 * 재시도: exchange/bithumb/client.ts의 requestPrivate에서 429/5xx/timeout 처리
 */
export class BithumbPrivateApi {
  private readonly limiter: RateLimiter;
  private readonly market = 'KRW-BTC';

  constructor() {
    this.limiter = new RateLimiter(10);
  }

  /**
   * 시장가 매수 (price = KRW 금액)
   * ord_type: 'price' → 시장가 매수 (KRW 금액 지정)
   */
  async marketBuy(krwAmount: number): Promise<BithumbOrderResult> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.placeOrder({
        market: this.market,
        side: 'bid',
        ord_type: 'price',
        price: String(Math.floor(krwAmount)),
      });
      return this.parseOrderResult(res);
    } catch (err) {
      log.warn({ err, krwAmount }, 'marketBuy failed');
      return { orderId: '', status: 'error', message: String(err) };
    }
  }

  /**
   * 시장가 매도 (volume = BTC 수량)
   * ord_type: 'market' → 시장가 매도 (BTC 수량 지정)
   */
  async marketSell(btcQty: number): Promise<BithumbOrderResult> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.placeOrder({
        market: this.market,
        side: 'ask',
        ord_type: 'market',
        volume: String(btcQty),
      });
      return this.parseOrderResult(res);
    } catch (err) {
      log.warn({ err, btcQty }, 'marketSell failed');
      return { orderId: '', status: 'error', message: String(err) };
    }
  }

  /**
   * 지정가 매수
   * ord_type: 'limit'
   */
  async limitBuy(price: number, btcQty: number): Promise<BithumbOrderResult> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.placeOrder({
        market: this.market,
        side: 'bid',
        ord_type: 'limit',
        price: String(Math.floor(price)),
        volume: String(btcQty),
      });
      return this.parseOrderResult(res);
    } catch (err) {
      log.warn({ err, price, btcQty }, 'limitBuy failed');
      return { orderId: '', status: 'error', message: String(err) };
    }
  }

  /**
   * 지정가 매도
   * ord_type: 'limit'
   */
  async limitSell(price: number, btcQty: number): Promise<BithumbOrderResult> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.placeOrder({
        market: this.market,
        side: 'ask',
        ord_type: 'limit',
        price: String(Math.floor(price)),
        volume: String(btcQty),
      });
      return this.parseOrderResult(res);
    } catch (err) {
      log.warn({ err, price, btcQty }, 'limitSell failed');
      return { orderId: '', status: 'error', message: String(err) };
    }
  }

  /**
   * 주문 취소 (DELETE /v1/order?uuid=...)
   */
  async cancelOrder(uuid: string): Promise<boolean> {
    await this.limiter.acquire();
    try {
      await bithumb.cancelOrder(uuid);
      log.info({ uuid }, 'Order cancelled');
      return true;
    } catch (err) {
      log.warn({ err, uuid }, 'cancelOrder failed');
      return false;
    }
  }

  /**
   * 개별 주문 조회 (GET /v1/order?uuid=...)
   * 시장가 매수(ord_type=price) 시 price = 주문 KRW 금액, executed_volume = 체결된 BTC 수량 → 평균체결가 = price/executed_volume
   */
  async getOrder(uuid: string): Promise<BithumbOrderInfo | null> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.getOrder(uuid) as Record<string, unknown> | null;
      if (!res) return null;

      const executedVolume = Number(res['executed_volume'] ?? 0);
      return {
        orderId: String(res['uuid'] ?? uuid),
        side: res['side'] === 'bid' ? 'bid' : 'ask',
        type: String(res['ord_type'] ?? ''),
        price: Number(res['price'] ?? 0),
        qty: Number(res['volume'] ?? 0),
        status: String(res['state'] ?? ''),
        filledQty: executedVolume,
        executedVolume,
      };
    } catch (err) {
      log.warn({ err, uuid }, 'getOrder failed');
      return null;
    }
  }

  /**
   * 주문 리스트 (GET /v1/orders?market=...&state=...)
   * state: wait | watch | done | cancel
   */
  async getOrders(params: { market?: string; state?: string; page?: number; limit?: number }): Promise<BithumbOrderListItem[]> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.getOrders({
        market: params.market ?? this.market,
        state: params.state,
        page: params.page,
        limit: params.limit,
      }) as unknown;
      if (!Array.isArray(res)) {
        const obj = res as Record<string, unknown>;
        const arr = (obj?.data ?? obj?.orders ?? obj) as unknown;
        if (!Array.isArray(arr)) return [];
        return arr as BithumbOrderListItem[];
      }
      return res as BithumbOrderListItem[];
    } catch (err) {
      log.warn({ err }, 'getOrders failed');
      return [];
    }
  }

  /**
   * 잔고 조회 (GET /v1/accounts)
   * 응답: [{ currency, balance, locked, ... }, ...]
   */
  async getBalance(): Promise<BithumbBalance> {
    await this.limiter.acquire();
    try {
      const res = await bithumb.getAccounts();

      // v1 /accounts 응답은 배열이거나 { data: [...] }
      let accounts: Array<Record<string, unknown>>;
      if (Array.isArray(res)) {
        accounts = res as Array<Record<string, unknown>>;
      } else if (res && typeof res === 'object' && 'data' in res) {
        const data = (res as Record<string, unknown>)['data'];
        accounts = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
      } else {
        accounts = [];
      }

      let totalKrw = 0, availableKrw = 0, totalBtc = 0, availableBtc = 0;

      for (const acc of accounts) {
        const currency = String(acc['currency'] ?? '');
        const balance = Number(acc['balance'] ?? 0);
        const locked = Number(acc['locked'] ?? 0);

        if (currency === 'KRW') {
          availableKrw = balance;
          totalKrw = balance + locked;
        } else if (currency === 'BTC') {
          availableBtc = balance;
          totalBtc = balance + locked;
        }
      }

      return { totalKrw, availableKrw, totalBtc, availableBtc };
    } catch (err) {
      log.error({ err }, 'getBalance failed');
      throw err;
    }
  }

  /**
   * 주문 가능 정보 (GET /v1/orders/chance?market=KRW-BTC)
   */
  async getOrderChance(): Promise<unknown> {
    await this.limiter.acquire();
    try {
      return await bithumb.getOrdersChance(this.market);
    } catch (err) {
      log.warn({ err }, 'getOrderChance failed');
      return null;
    }
  }

  // ── 응답 파싱 ─────────────────────────────────────────────────
  private parseOrderResult(res: unknown): BithumbOrderResult {
    if (!res || typeof res !== 'object') {
      return { orderId: '', status: 'error', message: 'Empty response' };
    }

    const r = res as Record<string, unknown>;

    // v1 성공 시 uuid 필드 존재
    if (r['uuid']) {
      const orderId = String(r['uuid']);
      log.info({ orderId }, 'Order placed');
      return { orderId, status: 'success' };
    }

    // 에러 (빗썸: { error: { name, message } })
    const errObj = r['error'] as { name?: string; message?: string } | undefined;
    const errMsg =
      (errObj && typeof errObj === 'object' && errObj.message)
        ? errObj.message
        : (r['message'] ?? JSON.stringify(r));
    if (errObj?.name === 'bank_account_required') {
      log.warn({ res: r }, 'Order failed — 실명확인 및 입출금 계좌 등록 후 이용 가능합니다.');
    } else {
      log.warn({ res: r }, 'Order failed');
    }
    return { orderId: '', status: 'error', message: String(errMsg) };
  }
}
