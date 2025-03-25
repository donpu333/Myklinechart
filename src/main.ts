import { KLineChartPro, DefaultDatafeed } from './index';

const container = document.getElementById('container');
let chart: KLineChartPro | null = null;

if (container) {
  chart = new KLineChartPro({
    container: container,
    symbol: {
      exchange: 'BINANCE',
      market: 'crypto',
      name: 'Bitcoin / Tether',
      shortName: 'BTCUSDT',
      ticker: 'BTCUSDT',
      priceCurrency: 'USDT',
      type: 'cryptocurrency',
    },
    period: { multiplier: 15, timespan: 'minute', text: '15m' },
    datafeed: new DefaultDatafeed(),
  });
} else {
  console.error('Container element not found');
}
