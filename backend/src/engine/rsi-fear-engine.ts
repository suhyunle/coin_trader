import { config } from '../config.js';
import { createChildLogger } from '../logger.js';
import type { Candle } from '../types/index.js';
import { portfolioTracker } from '../portfolio-tracker.js';
import { StrategyB_RSI_Fear } from '../strategy/strategyB_RSI_Fear.js';
import { ATR } from '../indicators/atr.js';

const log = createChildLogger('rsi-fear-engine');
const cfg = config.strategyB_RSI_Fear;
const feeRate = config.execution.feeRate;

/** AUTO ON일 때만 진입/청산 */
export type GetAuto = () => boolean;

/**
 * 전략 B 전용 러너 — shortTerm 포지션만 사용, 분할 매수 3회
 */
export class RsiFearEngine {
  private readonly strategy: StrategyB_RSI_Fear;
  private readonly atr: ATR;
  private readonly getAuto: GetAuto;

  constructor(getAuto: GetAuto) {
    this.strategy = new StrategyB_RSI_Fear();
    this.atr = new ATR(config.strategy.atrPeriod);
    this.getAuto = getAuto;
  }

  warmup(candles: Candle[]): void {
    for (const c of candles) {
      this.strategy.onCandle(c);
      this.atr.update(c);
    }
  }

  onCandle(candle: Candle): void {
    const st = portfolioTracker.getShortTerm();

    // 스톱/트레일 체크 (포지션 있을 때)
    if (st.btcQty > 0) {
      const effectiveStop = Math.max(st.stopLossKrw, st.trailingStopKrw);
      if (candle.low <= effectiveStop) {
        this.executeExit(candle, effectiveStop);
        return;
      }
      if (candle.high > st.entryPriceKrw && this.atr.isReady) {
        const newTrailing = candle.high - this.atr.value * cfg.trailingStopAtrMultiplier;
        if (newTrailing > st.trailingStopKrw) {
          portfolioTracker.updateShortTermTrailing(newTrailing);
        }
      }
    }

    this.atr.update(candle);
    const signal = this.strategy.onCandle(candle);

    if (!this.getAuto()) return;

    if (signal.action === 'LONG_ENTRY') {
      const st2 = portfolioTracker.getShortTerm();
      if (st2.entrySplitsLeft > 0) {
        this.executeSplitEntry(candle);
      }
      if (st2.btcQty > 0 || st2.entrySplitsLeft < config.strategyB_RSI_Fear.entrySplits) {
        this.strategy.setInPosition();
      }
    } else if (signal.action === 'LONG_EXIT' && st.btcQty > 0) {
      this.executeExit(candle, candle.close);
    }
  }

  private executeSplitEntry(candle: Candle): void {
    const st = portfolioTracker.getShortTerm();
    if (st.entrySplitsLeft <= 0 || st.cashKrw <= 0) return;

    const allocPerSplit = (config.capital.initialKrw * config.capital.maxAllocationRsiFear) / cfg.entrySplits;
    const amountKrw = Math.min(allocPerSplit, st.cashKrw * 0.95);
    if (amountKrw < 10_000) return;

    const price = candle.close;
    const btc = amountKrw / price;
    const fee = btc * price * feeRate;
    const stopLoss = price * (1 - cfg.stopLossPct / 100);

    portfolioTracker.applyShortTermEntry(amountKrw + fee, btc, price, stopLoss, st.entrySplitsLeft - 1);
    this.strategy.setInPosition();
    log.info({ amountKrw, btc, price, splitsLeft: st.entrySplitsLeft - 1 }, 'RSI_Fear split entry');
  }

  private executeExit(_candle: Candle, exitPrice: number): void {
    const st = portfolioTracker.getShortTerm();
    if (st.btcQty <= 0) return;

    const fee = st.btcQty * exitPrice * feeRate;
    const krwReceived = st.btcQty * exitPrice - fee;
    const pnl = krwReceived - st.entryPriceKrw * st.btcQty;

    portfolioTracker.applyShortTermExit(krwReceived);
    this.strategy.notifyPositionClosed();
    log.info({ exitPrice, pnl, qty: st.btcQty }, 'RSI_Fear exit');
  }
}
