import { PricePoint } from '../types';

// Binance WebSocket for real-time BTC price
const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const BINANCE_REST = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';
const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=30';

let currentPrice = 0;
let priceHistory: PricePoint[] = [];
let listeners: ((price: number) => void)[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;
let ws: WebSocket | null = null;
let initialized = false;
let wsConnected = false;

// Fetch real price via REST as fallback
async function fetchRestPrice(): Promise<number | null> {
  try {
    const res = await fetch(BINANCE_REST);
    const data = await res.json();
    return data?.price ? parseFloat(data.price) : null;
  } catch {
    return null;
  }
}

// Fetch real 30min history from Binance klines
async function fetchRealHistory(): Promise<PricePoint[]> {
  try {
    const res = await fetch(BINANCE_KLINES);
    const data = await res.json();
    return data.map((k: any[]) => ({
      time: k[0] as number,
      price: parseFloat(k[4] as string), // close price
    }));
  } catch {
    return [];
  }
}

function addPricePoint(price: number) {
  currentPrice = Math.round(price * 100) / 100;
  const point: PricePoint = { time: Date.now(), price: currentPrice };
  priceHistory.push(point);

  // Keep last 30 min
  const cutoff = Date.now() - 30 * 60 * 1000;
  priceHistory = priceHistory.filter(p => p.time >= cutoff);

  listeners.forEach(cb => cb(currentPrice));
}

function connectWebSocket() {
  if (ws) return;
  try {
    ws = new WebSocket(BINANCE_WS);

    ws.onopen = () => {
      wsConnected = true;
      console.log('[PriceService] Binance WS connected');
      // Stop simulation if running
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.p) {
          addPricePoint(parseFloat(data.p));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      wsConnected = false;
      ws = null;
      console.log('[PriceService] Binance WS disconnected, falling back to simulation');
      startSimulation();
      // Try reconnect after 5s
      setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    startSimulation();
  }
}

function startSimulation() {
  if (intervalId || wsConnected) return;
  // Fallback simulation when WebSocket is unavailable
  intervalId = setInterval(() => {
    const volatility = 0.0002;
    const drift = (Math.random() - 0.498) * currentPrice * volatility;
    const jump = Math.random() < 0.05 ? (Math.random() - 0.5) * currentPrice * 0.001 : 0;
    const newPrice = Math.max(currentPrice + drift + jump, 20000);
    addPricePoint(newPrice);
  }, 2000);
}

export const PriceService = {
  async init() {
    if (initialized) return;
    initialized = true;

    // 1. Get initial price via REST
    const restPrice = await fetchRestPrice();
    if (restPrice) {
      currentPrice = restPrice;
    } else {
      currentPrice = 87500; // reasonable fallback
    }

    // 2. Load real history
    const realHistory = await fetchRealHistory();
    if (realHistory.length > 0) {
      priceHistory = realHistory;
      currentPrice = realHistory[realHistory.length - 1].price;
    } else {
      // Generate synthetic history based on real price
      const now = Date.now();
      priceHistory = [];
      let p = currentPrice;
      for (let i = 180; i >= 0; i--) {
        p += (Math.random() - 0.498) * 15;
        p = Math.max(p, 20000);
        priceHistory.push({ time: now - i * 10000, price: p });
      }
      currentPrice = priceHistory[priceHistory.length - 1].price;
    }

    // 3. Connect WebSocket for real-time updates
    connectWebSocket();

    // 4. Start simulation as fallback (will be stopped if WS connects)
    setTimeout(() => {
      if (!wsConnected) startSimulation();
    }, 3000);
  },

  getPrice(): number {
    return currentPrice;
  },

  isLive(): boolean {
    return wsConnected;
  },

  getHistory(): PricePoint[] {
    return [...priceHistory];
  },

  getHistoryForDuration(minutes: number): PricePoint[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return priceHistory.filter(p => p.time >= cutoff);
  },

  subscribe(cb: (price: number) => void): () => void {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter(l => l !== cb);
    };
  },

  destroy() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    listeners = [];
    initialized = false;
    wsConnected = false;
  }
};
