import { KLineChartPro, DefaultDatafeed } from './index';

const container = document.getElementById('container');
let chart: KLineChartPro | null = null;

if (container) {
  chart = new KLineChartPro({
    container: container,
    locale: 'ru-RU',
    symbol: {
      exchange: 'BINANCE',
      market: 'crypto',
      name: 'Биткоин / Tether',
      shortName: 'BTCUSDT',
      ticker: 'BTCUSDT',
      priceCurrency: 'USDT',
      type: 'cryptocurrency',
    },
    period: {
      multiplier: 1, // Устанавливаем период 1 день
      timespan: 'day',
      text: '1 день'
    },
    periods: [
      { multiplier: 1, timespan: 'minute', text: '1 мин' },
      { multiplier: 5, timespan: 'minute', text: '5 мин' },
      { multiplier: 15, timespan: 'minute', text: '15 мин' },
      { multiplier: 1, timespan: 'hour', text: '1 час' },
      { multiplier: 4, timespan: 'hour', text: '4 часа' },
      { multiplier: 1, timespan: 'day', text: '1 день' }
    ],
    mainIndicators: [],
    subIndicators: ['VOL', 'MACD'],
    datafeed: new DefaultDatafeed(),
    styles: {
      candle: {
        upColor: '#089981',
        downColor: '#b22833',
        tooltip: {
          showOhlc: false // Отключаем OHLC в тултипе
        }
      },
      grid: {
        show: false // Отключаем сетку
      }
    }
  });

  if (chart) {
    const price = 93844;
    const overlayId = chart.addCustomOverlay({
      name: 'horizontalLine',
      points: [{ price }],
      styles: { 
        color: '#f00',
        text: {
          text: `Уровень ${price}`,
          color: '#FFFFFF',
          backgroundColor: '#f00',
          padding: [4, 8],
          font: '14px Arial'
        }
      }
    });

    setTimeout(() => {
      try {
        const widget = (chart as any).widget;
        if (widget) {
          const coords = widget.convertToPixel({ price }, 'candle_pane');
          const y = coords.y;

          const priceLabel = document.createElement('div');
          priceLabel.className = 'klinecharts-pro-price-label';
          priceLabel.style.position = 'absolute';
          priceLabel.style.right = '10px';
          priceLabel.style.top = `${y}px`;
          priceLabel.style.backgroundColor = '#f00';
          priceLabel.style.color = '#FFFFFF';
          priceLabel.style.padding = '4px 8px';
          priceLabel.style.borderRadius = '4px';
          priceLabel.style.fontSize = '14px';
          priceLabel.style.zIndex = '100';
          priceLabel.innerHTML = price.toFixed(2);

          const widgetRef = container.querySelector('.klinecharts-pro-widget');
          if (widgetRef) {
            widgetRef.appendChild(priceLabel);
            console.log(`Метка добавлена вручную: price=${price}, y=${y}, id=${overlayId}`);
          } else {
            console.error('Не удалось найти .klinecharts-pro-widget для добавления метки');
          }

          widget.subscribeAction('onZoom', () => {
            const newCoords = widget.convertToPixel({ price }, 'candle_pane');
            priceLabel.style.top = `${newCoords.y}px`;
          });
          widget.subscribeAction('onScroll', () => {
            const newCoords = widget.convertToPixel({ price }, 'candle_pane');
            priceLabel.style.top = `${newCoords.y}px`;
          });
        } else {
          console.error('Не удалось получить widget из chart');
        }
      } catch (error) {
        console.error('Ошибка при добавлении метки:', error);
      }
    }, 2000);

    setInterval(() => {
      const currentTime = new Date();
      const seconds = currentTime.getSeconds();
      const timeLeft = 60 - seconds;
      console.log(`До закрытия дневного бара: ${timeLeft} сек`);
      
      const timerElement = document.getElementById('bar-timer');
      if (timerElement) {
        timerElement.textContent = `Закрытие через: ${timeLeft} сек`;
      }
    }, 1000);
  }
} else {
  console.error('Элемент контейнера не найден');
}