/**
 * 시스템에서 지원하는 거래소 목록 (전체 거래소 목록 API용)
 */

export interface ExchangeItem {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  /** 현재 봇에서 사용 중인 거래소 여부 */
  active: boolean;
  /** 지원 마켓 예: KRW-BTC */
  defaultMarket?: string;
  /** API 공개 문서 등 */
  docsUrl?: string;
}

const EXCHANGES: ExchangeItem[] = [
  {
    id: 'bithumb',
    name: '빗썸',
    nameEn: 'Bithumb',
    country: 'KR',
    active: true,
    defaultMarket: 'KRW-BTC',
    docsUrl: 'https://api.bithumb.com/',
  },
  // 추후 확장 시 여기에 추가
];

export function getExchanges(): ExchangeItem[] {
  return [...EXCHANGES];
}
