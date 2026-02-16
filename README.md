# coin_trader

BTC/KRW 5분봉 롱전용 트레이딩 시스템 (빗썸 연동)

- **backend/** — Node.js + TypeScript 트레이딩 엔진 (PAPER / LIVE)
- **frontend/** — Next.js 15 대시보드

## Quick Start

```bash
# 루트에서
npm install
npm run backend   # 백엔드 (API: http://localhost:4000)
npm run frontend  # 대시보드 (http://localhost:3000)
```

## Backend (backend/ 디렉터리에서)

- `npm run paper` — 페이퍼 트레이딩
- `npm run live` — 라이브 트레이딩
- `npm run backtest` — 백테스트
- `npm run sweep` — 파라미터 스윕

`.env` 설정은 `backend/.env.example` 참고.
