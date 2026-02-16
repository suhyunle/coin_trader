import type { Candle, StrategySignal } from '../types/index.js';
import type { Strategy, StrategyParams } from './strategy.js';
import { DonchianChannel } from '../indicators/donchian.js';
import { ATR } from '../indicators/atr.js';
import { EMA } from '../indicators/ema.js';

export interface DonchianBreakoutParams extends StrategyParams {
  readonly donchianPeriod: number;    // 돈치안 채널 기간 (기본 20)
  readonly atrPeriod: number;         // ATR 기간 (기본 14)
  readonly atrStopMultiplier: number; // 초기 SL ATR 배수 (기본 2.0)
  readonly emaFilterPeriod: number;   // EMA 필터 기간 (0이면 미사용)
}

const DEFAULT_PARAMS: DonchianBreakoutParams = {
  donchianPeriod: 20,
  atrPeriod: 14,
  atrStopMultiplier: 2.0,
  emaFilterPeriod: 50,
};

/**
 * Donchian Breakout 전략 (롱전용)
 *
 * 진입: close가 Donchian 상단 돌파 + EMA 위
 * 청산: close가 Donchian 하단 이탈 (또는 SL/트레일링)
 */
export class DonchianBreakout implements Strategy {
  readonly name = 'DonchianBreakout';
  readonly params: DonchianBreakoutParams;

  private donchian: DonchianChannel;
  private atr: ATR;
  private ema: EMA;
  private inPosition: boolean = false;
  private prevUpper: number = 0;
  private prevLower: number = 0;

  constructor(params?: Partial<DonchianBreakoutParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.donchian = new DonchianChannel(this.params.donchianPeriod);
    this.atr = new ATR(this.params.atrPeriod);
    this.ema = new EMA(this.params.emaFilterPeriod || 1);
  }

  onCandle(candle: Candle): StrategySignal {
    // 인디케이터 업데이트 (이전 값 보존)
    const prevUpper = this.prevUpper;
    const prevLower = this.prevLower;

    const dc = this.donchian.update(candle);
    this.atr.update(candle);
    this.ema.update(candle.close);

    this.prevUpper = dc.upper;
    this.prevLower = dc.lower;

    // 모든 인디케이터 준비 전에는 NONE
    if (!this.donchian.isReady || !this.atr.isReady) {
      return { action: 'NONE' };
    }

    // EMA 필터가 설정된 경우
    const emaFilter = this.params.emaFilterPeriod > 0
      ? this.ema.isReady && candle.close > this.ema.value
      : true;

    // 포지션 없을 때 → 진입 조건 확인
    if (!this.inPosition) {
      // close가 이전 봉의 상단을 돌파 + EMA 필터
      if (prevUpper > 0 && candle.close > prevUpper && emaFilter) {
        this.inPosition = true;
        const sl = candle.close - this.atr.value * this.params.atrStopMultiplier;
        return {
          action: 'LONG_ENTRY',
          stopLoss: sl,
          reason: `Donchian upper breakout: ${candle.close} > ${prevUpper}`,
        };
      }
    } else {
      // 포지션 있을 때 → 청산 조건 확인
      // close가 이전 봉의 하단 이탈
      if (prevLower > 0 && candle.close < prevLower) {
        this.inPosition = false;
        return {
          action: 'LONG_EXIT',
          reason: `Donchian lower break: ${candle.close} < ${prevLower}`,
        };
      }
    }

    return { action: 'NONE' };
  }

  /** 외부에서 포지션 상태를 동기화 (스톱 히트로 청산 시) */
  notifyPositionClosed(): void {
    this.inPosition = false;
  }

  reset(): void {
    this.donchian.reset();
    this.atr.reset();
    this.ema.reset();
    this.inPosition = false;
    this.prevUpper = 0;
    this.prevLower = 0;
  }
}
