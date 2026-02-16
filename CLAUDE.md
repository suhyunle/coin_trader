# Project: BTC/KRW 5분봉 롱전용 트레이딩 시스템

## Monorepo
- **backend/** — Node/TS 트레이딩 엔진 (기존 코드)
- **frontend/** — Next.js 15 (App Router, TypeScript) 대시보드

## Tech Stack
- **Backend**: Node 20, TypeScript 5.4+ (strict), ESM, tsx, vitest, better-sqlite3, pino, ws, dotenv
- **Frontend**: Next.js 15, React 19, TypeScript

## Commands (루트)
- `npm test` — 백엔드 vitest (46 tests)
- `npm run build` — backend tsc + frontend next build
- `npm run backend` — 백엔드 시작 (paper/live는 backend 폴더에서 `npm run paper` 등)
- `npm run frontend` — Next.js dev 서버 (http://localhost:3000)

## Backend 전용 (backend/ 디렉터리에서)
- `npm run backtest` — 백테스트
- `npm run sweep` — 파라미터 스윕
- `npm run paper` — 페이퍼 트레이딩
- `npm run live` — 라이브 트레이딩
- `npm start` — 기본 모드(.env MODE)

## Architecture
- **이벤트 드리븐**: EventBus로 모든 주문/체결/포지션 이벤트 기록 → 리플레이 가능
- **Strategy 인터페이스**: `onCandle(candle) → StrategySignal` — 백테스트/페이퍼/라이브 동일
- **모드 3단계**: BACKTEST → PAPER → LIVE (자동/수동 프로모션)
- **1포지션 룰**: 롱전용, 동시에 1개 포지션만 허용
- **상태 머신**: IDLE → ENTRY_PENDING → IN_POSITION → EXIT_PENDING → COOLDOWN / HALTED

## Key Directories (backend/)
- `backend/src/types/` — 모든 타입 정의
- `backend/src/market/` — 빗썸 WebSocket(재연결/heartbeat) + Public REST
- `backend/src/candles/` — Tick→5분봉 집계 + SQLite 저장 + 정합성 체크
- `backend/src/indicators/` — ATR(Wilder), Donchian, EMA
- `backend/src/engine/` — BacktestEngine, PaperEngine, LiveEngine
- `backend/src/strategy/` — Strategy 인터페이스 + DonchianBreakout
- `backend/src/execution/` — 빗썸 Private API (JWT HS256), Rate Limiter
- `backend/src/risk/` — PositionSizer, RiskManager, StateMachine
- `backend/src/safety/` — KillSwitch, AuditLog
- `backend/src/mode/` — ModeManager (PAPER→LIVE 프로모션 로직)
- `backend/src/report/` — 메트릭, 포맷터, 트레이드 로그
- `backend/src/optimization/` — 파라미터 스윕, 워크포워드
- `frontend/src/app/` — Next.js App Router 페이지/레이아웃

## Config
- **Backend**: `backend/.env` (또는 루트 `.env`), `backend/.env.example` 참조
- API 키, 리스크 파라미터, 전략 파라미터, 프로모션 조건 등
- **Frontend**: `frontend/.env.local` (필요 시 API URL 등)

## Conventions
- 새 전략 추가 시 `Strategy` 인터페이스 구현
- 테스트는 `tests/` 디렉토리, `*.test.ts` 패턴
- 한국어 주석 허용, 코드/변수명은 영어
- 킬스위치: k키(터미널), HALTED 상태, 신규 주문 금지
