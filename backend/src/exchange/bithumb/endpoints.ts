/**
 * 빗썸 Open API REST 엔드포인트 — 단일 정의.
 * 코드 어디에서도 문자열 URL을 직접 쓰지 않고 이 상수만 사용한다.
 */

export const BITHUMB_REST_BASE = 'https://api.bithumb.com';

// ─── PUBLIC ─────────────────────────────────────────────────────────────

/** GET 마켓 코드 조회 */
export const PUBLIC_MARKET_ALL = '/v1/market/all';

/** GET 분 캔들 — unit=5 사용 시 5분봉 */
export function publicCandlesMinutes(unit: number): string {
  return `/v1/candles/minutes/${unit}`;
}

/** GET 일 캔들 */
export const PUBLIC_CANDLES_DAYS = '/v1/candles/days';

/** GET 주 캔들 */
export const PUBLIC_CANDLES_WEEKS = '/v1/candles/weeks';

/** GET 월 캔들 */
export const PUBLIC_CANDLES_MONTHS = '/v1/candles/months';

/** GET 최근 체결 내역 */
export const PUBLIC_TRADES_TICKS = '/v1/trades/ticks';

/** GET 현재가 정보 */
export const PUBLIC_TICKER = '/v1/ticker';

/** GET 호가 정보 */
export const PUBLIC_ORDERBOOK = '/v1/orderbook';

/** GET 경보제(가상자산 경고) */
export const PUBLIC_VIRTUAL_ASSET_WARNING = '/v1/market/virtual_asset_warning';

// ─── PRIVATE (개인용, 출금/입금 제외) ───────────────────────────────────

/** GET 전체 계좌 조회(자산) */
export const PRIVATE_ACCOUNTS = '/v1/accounts';

/** GET 주문 가능 정보 */
export const PRIVATE_ORDERS_CHANCE = '/v1/orders/chance';

/** GET 개별 주문 조회 */
export const PRIVATE_ORDER = '/v1/order';

/** GET 주문 리스트 조회 */
export const PRIVATE_ORDERS = '/v1/orders';

/** DELETE 주문 취소 접수 */
export const PRIVATE_ORDER_DELETE = '/v1/order';

/** POST 주문하기 */
export const PRIVATE_ORDERS_POST = '/v1/orders';

// ─── TWAP (옵션) ────────────────────────────────────────────────────────

/** GET TWAP 주문 내역 조회 */
export const PRIVATE_TWAP = '/v1/twap';

/** DELETE TWAP 주문 취소 */
export const PRIVATE_TWAP_DELETE = '/v1/twap';

/** POST TWAP 주문하기 */
export const PRIVATE_TWAP_POST = '/v1/twap';
