import axios from "axios";

class DefaultDatafeed {
  private wsBinance: WebSocket | null = null;
  private currentSymbol: SymbolInfo | null = null;
  private currentPeriod: Period | null = null;
  private lastCandle: KLineData | null = null;

  // Метод поиска символов
  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    console.log("searchSymbols called with search:", search);
    try {
      // Получение символов с Binance (спот)
      const spotResponse = await axios.get(
        "https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT"
      );
      console.log("Fetched spot exchange info:", spotResponse.data);

      const spotSymbols = spotResponse.data.symbols
        .filter(
          (symbol: any) =>
            symbol.quoteAsset === "USDT" && symbol.status === "TRADING"
        )
        .map((symbol: any) => ({
          ticker: symbol.symbol,
          fullName: `${symbol.baseAsset}/${symbol.quoteAsset}`,
          description: `${symbol.baseAsset}/${symbol.quoteAsset}`,
          exchange: "Binance Spot",
          type: "crypto",
        }));

      console.log("Filtered Spot symbols:", spotSymbols);

      // Получение символов с Binance (фьючерсы)
      const futuresResponse = await axios.get(
        "https://fapi.binance.com/fapi/v1/exchangeInfo"
      );
      console.log("Fetched futures exchange info:", futuresResponse.data);

      const futuresSymbols = futuresResponse.data.symbols
        .filter((symbol: any) => symbol.status === "TRADING")
        .map((symbol: any) => ({
          ticker: symbol.symbol,
          fullName: `${symbol.baseAsset}/${symbol.quoteAsset}`,
          description: `${symbol.baseAsset}/${symbol.quoteAsset} Futures`,
          exchange: "Binance Futures",
          type: "futures",
        }));

      console.log("Filtered Futures symbols:", futuresSymbols);

      // Объединяем все символы
      const symbols = [
        ...spotSymbols,
        ...futuresSymbols
      ];
  
      // Применяем фильтр поиска
      const filteredSymbols = search
        ? symbols.filter(
            (symbol: any) =>
              symbol.ticker.toLowerCase().includes(search.toLowerCase()) ||
              (symbol.fullName &&
                symbol.fullName.toLowerCase().includes(search.toLowerCase()))
          )
        : symbols;

      console.log("Filtered symbols based on search:", filteredSymbols);
      return filteredSymbols;
    } catch (error) {
      console.error("Ошибка получения символов:", error);
      return [];
    }
  }

  // Метод получения исторических данных
  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    return this.getBinanceHistoryKLineData(symbol, period, from, to);
  }

  // Метод получения исторических данных от Binance
  private async getBinanceHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
    try {
      const interval = this.convertPeriodToInterval(period);
      console.log("Converted period to interval:", interval);

      const baseUrl =
        symbol.type === "futures"
          ? "https://fapi.binance.com/fapi/v1/klines"
          : "https://api.binance.com/api/v3/klines";

      const url = `${baseUrl}?symbol=${symbol.ticker}&interval=${interval}&startTime=${from}&endTime=${to}`;
      console.log("Fetching historical data from URL:", url);

      const response = await axios.get(url);
      console.log("Fetched historical data:", response.data);

      const klineData = response.data.map((kline: any) => ({
        timestamp: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      }));
      console.log("Parsed kline data:", klineData);
      return klineData;
    } catch (error) {
      console.error("Ошибка загрузки исторических данных с Binance:", error);
      return [];
    }
  }

  // Метод подписки на данные
  async subscribe(
    symbol: SymbolInfo,
    period: Period,
    callback: DatafeedSubscribeCallback
  ): Promise<void> {
    if (
      this.currentSymbol?.ticker === symbol.ticker &&
      this.currentPeriod?.multiplier === period.multiplier &&
      this.currentPeriod?.timespan === period.timespan
    ) {
      console.log("Symbol/period are the same, skip re-subscribe");
      return;
    }
    console.log("subscribe called with:", { symbol, period });

    // Отписываемся от предыдущей подписки
    if (this.currentSymbol && this.currentPeriod) {
      this.unsubscribe(this.currentSymbol, this.currentPeriod);
    }

    // Сохраняем текущий символ и период
    this.currentSymbol = symbol;
    this.currentPeriod = period;

    // Загружаем исторические данные
    const now = Date.now();
    const from = now - 86400000 * 7; // 7 дней назад
    const historicalData = await this.getHistoryKLineData(
      this.currentSymbol,
      period,
      from,
      now
    );

    console.log("Historical data for chart:", historicalData);
    historicalData.forEach((data) => callback(data)); // Передаём исторические данные в график

    // Binance WebSocket
    const interval = this.convertPeriodToInterval(period);
    console.log("Converted period to interval:", interval);

    const wsUrl =
      symbol.type === "futures"
        ? `wss://fstream.binance.com/ws/${symbol.ticker.toLowerCase()}@kline_${interval}`
        : `wss://stream.binance.com:9443/ws/${symbol.ticker.toLowerCase()}@kline_${interval}`;
    console.log("Connecting to Binance WebSocket URL:", wsUrl);

    // Закрываем предыдущий Binance WebSocket, если он существует
    if (this.wsBinance) {
      this.wsBinance.close();
    }

    this.wsBinance = new WebSocket(wsUrl);

    this.wsBinance.onopen = () => {
      console.log("Binance WebSocket connection opened.");
    };

    this.wsBinance.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data.toString());
        if (message.e === "kline") {
          const kline = message.k;
          const klineData: KLineData = {
            timestamp: kline.t,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v),
          };

          if (kline.x) {
            // Свеча закрыта, добавляем её как новую
            this.lastCandle = null; // Сбрасываем текущую открытую свечу
            callback(klineData);
          } else {
            // Свеча открыта, обновляем текущую свечу
            if (this.lastCandle) {
              // Обновляем существующую открытую свечу
              this.lastCandle.high = Math.max(this.lastCandle.high, klineData.high);
              this.lastCandle.low = Math.min(this.lastCandle.low, klineData.low);
              this.lastCandle.close = klineData.close;
              this.lastCandle.volume = klineData.volume;
              callback(this.lastCandle);
            } else {
              // Создаём новую открытую свечу
              this.lastCandle = { ...klineData };
              callback(this.lastCandle);
            }
          }
        }
      } catch (error) {
        console.error("Error parsing Binance WebSocket message:", error);
      }
    };

    this.wsBinance.onclose = () => {
      console.log(
        "Binance WebSocket connection closed. Reconnecting in 5 seconds..."
      );
      setTimeout(() => {
        if (this.currentSymbol && this.currentPeriod) {
          this.subscribe(this.currentSymbol, this.currentPeriod, callback);
        }
      }, 5000);
    };

    this.wsBinance.onerror = (error) => {
      console.error("Binance WebSocket error:", error);
    };
  }

  // Метод отписки от данных
  unsubscribe(symbol: SymbolInfo, period: Period): void {
    console.log("unsubscribe called with:", { symbol, period });
    
    if (this.wsBinance) {
      this.wsBinance.close();
      this.wsBinance = null;
    }
    // Сброс текущей открытой свечи для Binance
    this.lastCandle = null;
  }

  // Метод конвертации периода в интервал Binance
  private convertPeriodToInterval(period: Period): string {
    console.log("convertPeriodToInterval called with:", period);
    const { multiplier, timespan } = period;
    const timespanMap: { [key: string]: string } = {
      second: "s",
      minute: "m",
      hour: "h",
      day: "d",
      week: "w",
      month: "M",
    };

    const interval = timespanMap[timespan]
      ? `${multiplier}${timespanMap[timespan]}`
      : "1m";
    console.log("Converted period to interval:", interval);
    return interval;
  }

  // Метод для получения длительности таймспана в миллисекундах
  private getTimespanInMs(timespan: Period['timespan']): number {
    switch (timespan) {
      case "second":
        return 1000;
      case "minute":
        return 60 * 1000;
      case "hour":
        return 60 * 60 * 1000;
      case "day":
        return 24 * 60 * 60 * 1000;
      case "week":
        return 7 * 24 * 60 * 60 * 1000;
      case "month":
        return 30 * 24 * 60 * 60 * 1000; // Примерная длительность
      default:
        return 60 * 1000;
    }
  }
}

// Типы
type SymbolInfo = {
  ticker: string;
  fullName: string;
  description: string;
  exchange: string;
  type: string;
};

type Period = {
  multiplier: number;
  timespan: "second" | "minute" | "hour" | "day" | "week" | "month";
  text: string;
};

type KLineData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type DatafeedSubscribeCallback = (data: KLineData) => void;

export default DefaultDatafeed;