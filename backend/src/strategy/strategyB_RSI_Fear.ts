import { config } from '../config.js';
import type { Candle, StrategySignal } from '../types/index.js';
import type { Strategy, StrategyParams } from './strategy.js';
import { RSI } from '../indicators/rsi.js';
import { getFearGreed } from '../data/fear-greed.js';

const cfg = config.strategyB_RSI_Fear;

/**
 * 전략 B: RSI + 공포지수 단기
 * 진입: RSI(14)<30, 공포지수<=20, 분할 매수 3회
 * 청산: RSI>70 또는 단기 과열(10봉 누적 상승률>X%) 또는 손절
 */
export class StrategyB_RSI_Fear implements Strategy {
  readonly name = 'RSI_Fear';
  readonly params: StrategyParams = { ...cfg };

  private readonly rsi: RSI;
  private readonly recentCloses: number[] = [];
  private inPosition: boolean = false;

  constructor(rsiPeriod?: number) {
    this.rsi = new RSI(rsiPeriod ?? cfg.rsiPeriod);
  }

  onCandle(candle: Candle): StrategySignal {
    this.rsi.update(candle);
    this.recentCloses.push(candle.close);
    if (this.recentCloses.length > cfg.overheatBars) this.recentCloses.shift();

    const rsi = this.rsi.value;
    const fear = getFearGreed();

    // 청산 조건
    if (this.inPosition) {
      if (rsi >= cfg.rsiOverbought) {
        return { action: 'LONG_EXIT', reason: `RSI ${rsi.toFixed(1)} >= ${cfg.rsiOverbought}` };
      }
      const overheat = this.getOverheatPct();
      if (overheat !== null && overheat >= cfg.overheatRisePct) {
        return { action: 'LONG_EXIT', reason: `Overheat +${overheat.toFixed(2)}%` };
      }
    }

    // 진입 조건: RSI 과매도 + 공포
    if (!this.rsi.isReady) return { action: 'NONE' };
    if (rsi < cfg.rsiOversold && fear <= cfg.fearMax) {
      return { action: 'LONG_ENTRY', reason: `RSI ${rsi.toFixed(1)} Fear ${fear}` };
    }

    return { action: 'NONE' };
  }

  private getOverheatPct(): number | null {
    if (this.recentCloses.length < cfg.overheatBars) return null;
    const first = this.recentCloses[0]!;
    const last = this.recentCloses[this.recentCloses.length - 1]!;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }

  notifyPositionClosed(): void {
    this.inPosition = false;
  }

  setInPosition(): void {
    this.inPosition = true;
  }

  reset(): void {
    this.rsi.reset();
    this.recentCloses.length = 0;
    this.inPosition = false;
  }

  getRsiValue(): number {
    return this.rsi.value;
  }
}
