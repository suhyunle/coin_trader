# PAPER 모드 검증 체크리스트

**설정**: `MODE=PAPER`, `AUTO=ON`  
**목적**: 실거래 없이 실전과 동일한 흐름이 동작하는지 확인

---

## 1. 실시간 5분봉 데이터 들어오는지

| 확인 | 항목 |
|------|------|
| ☐ | 백엔드 기동 후 로그에 `WebSocket connected`, `Subscribed (v1 format)` 출력 |
| ☐ | 5분마다(봉 마감 시) 로그에 `Candle closed` (ts, o, h, l, c, v) 출력 |
| ☐ | 대시보드 **차트**에 캔들이 쌓이고, **현재가**가 갱신됨 |

**구현 위치**: `main.ts` — WebSocket tick → `CandleAggregator` → 5분봉 완성 시 콜백 → `candleStore`, `dashboardState.setCandles` / `setLastPrice`

---

## 2. 조건 맞으면 “가상 주문” 생성되는지

| 확인 | 항목 |
|------|------|
| ☐ | 대시보드에서 **AUTO** 스위치가 **On** |
| ☐ | 전략 신호 `LONG_ENTRY` 시 로그에 `Paper entry` (price, qty, sl, equity) 출력 |
| ☐ | 대시보드 **이벤트 타임라인**에 `LONG 진입`, `FILL BUY` 등 표시 |
| ☐ | **Position** 카드에 Status LONG, Qty, Entry, Stop 표시 |

**구현 위치**: `paper-engine.ts` — `getAuto()` 일 때만 `tryEntry()` → 가상 체결 후 `posMgr.openPosition`, `bus.emit(ORDER_FILLED)` → `main`에서 `setEvents` / `setPosition`

---

## 3. 손절 / 익절 / 트레일링 자동 청산되는지

| 확인 | 항목 |
|------|------|
| ☐ | **손절**: 봉 저점이 초기 SL 이하가 되면 로그에 `Paper stop hit`, 이벤트에 청산 표시 |
| ☐ | **트레일링**: 고점 갱신 시 스톱 상향 → 이후 봉 저점이 트레일링 스톱 이하가 되면 자동 청산 |
| ☐ | **시그널 청산**: 전략이 `LONG_EXIT` 내면 `Paper exit` 로그, 이벤트에 청산·PnL 표시 |

**구현 위치**: `paper-engine.ts` — 매 봉 `posMgr.updateStops(candle, atr)` → 스톱 히트 시 `executeStop()`; 시그널 청산은 `tryExit()`. `position-manager.ts` — `updateStops()`에서 고점 갱신·트레일링 스톱 상향 및 유효 스톱 히트 판별

---

## 4. 대시보드에서 포지션 / 손익 / 이벤트가 보이는지

| 확인 | 항목 |
|------|------|
| ☐ | **포지션**: 우측 **Position** 카드에 FLAT/LONG, 수량, 진입가, 스톱, 미실현 손익 반영 |
| ☐ | **손익**: 포지션 보유 시 Unrealized PnL (KRW, %) 갱신 |
| ☐ | **이벤트**: 하단 타임라인에 시그널 / 진입 / 체결 / 청산 / 스톱 업데이트 순서로 표시 |
| ☐ | **트레이드**: **Trades** 카드에 완료된 round-trip (진입가·청산가·PnL·사유) 표시 |

**구현 위치**: `main.ts` 캔들 콜백에서 `setEvents`, `setTrades`, `setPosition` → `api-server.ts` `/api/state`, `/api/events`, `/api/trades`, `/api/position` → 프론트 `fetchState`, `fetchEvents`, `fetchTrades`, `fetchPosition` 폴링 후 표시

---

## 한 줄 요약

- **5분봉**: WS → Aggregator → 봉 마감 시마다 엔진 + 대시보드 갱신  
- **가상 주문**: AUTO ON + LONG_ENTRY 시 `tryEntry` → 가상 체결 → 이벤트/포지션 반영  
- **손절/트레일링**: 매 봉 `updateStops` → 스톱 히트 시 `executeStop`; 시그널 청산은 `tryExit`  
- **대시보드**: `/api/position`, `/api/events`, `/api/trades` 폴링으로 포지션·손익·이벤트 표시
