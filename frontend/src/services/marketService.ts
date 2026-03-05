import { Market, MarketDuration, Prediction, Bet, LeaderboardEntry, UserStats } from '../types';
import { PriceService } from './priceService';

let markets: Market[] = [];
let bets: Bet[] = [];
let marketCounter = 0;
let listeners: (() => void)[] = [];
let tickId: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function generateId(): string {
  return `mkt_${++marketCounter}_${Date.now()}`;
}

function createMarket(duration: MarketDuration): Market {
  const now = Date.now();
  return {
    id: generateId(),
    duration,
    startTime: now,
    lockTime: now + (duration * 60 - 30) * 1000, // lock 30s before end
    endTime: now + duration * 60 * 1000,
    startPrice: PriceService.getPrice(),
    status: 'open',
    totalUp: 0,
    totalDown: 0,
  };
}

function resolveMarket(market: Market) {
  const endPrice = PriceService.getPrice();
  market.endPrice = endPrice;
  market.status = 'resolved';
  market.result = endPrice >= market.startPrice ? 'UP' : 'DOWN';

  // Resolve bets
  bets
    .filter(b => b.marketId === market.id)
    .forEach(bet => {
      bet.won = bet.prediction === market.result;
      if (bet.won) {
        const totalPool = market.totalUp + market.totalDown;
        const winnerPool = market.result === 'UP' ? market.totalUp : market.totalDown;
        bet.payout = winnerPool > 0 ? Math.round((bet.amount / winnerPool) * totalPool) : bet.amount;
      } else {
        bet.payout = 0;
      }
    });
}

function tick() {
  const now = Date.now();
  let changed = false;

  markets.forEach(m => {
    if (m.status === 'open' && now >= m.lockTime) {
      m.status = 'locked';
      changed = true;
    }
    if ((m.status === 'open' || m.status === 'locked') && now >= m.endTime) {
      resolveMarket(m);
      changed = true;
    }
  });

  // Auto-create new markets if needed
  const durations: MarketDuration[] = [5, 10, 15];
  durations.forEach(d => {
    const active = markets.filter(m => m.duration === d && m.status !== 'resolved');
    if (active.length === 0) {
      markets.push(createMarket(d));
      changed = true;
    }
  });

  if (changed) {
    notify();
  }
}

function notify() {
  listeners.forEach(cb => cb());
}

export const MarketService = {
  init() {
    if (initialized) return;
    initialized = true;

    // Reset state
    markets = [];
    bets = [];
    marketCounter = 0;

    // Create initial markets — one per duration
    const durations: MarketDuration[] = [5, 10, 15];
    durations.forEach(d => {
      markets.push(createMarket(d));
    });

    if (!tickId) {
      tickId = setInterval(tick, 1000);
    }
  },

  getActiveMarkets(): Market[] {
    return markets.filter(m => m.status !== 'resolved').sort((a, b) => a.duration - b.duration);
  },

  getResolvedMarkets(limit = 20): Market[] {
    return markets
      .filter(m => m.status === 'resolved')
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, limit);
  },

  getMarket(id: string): Market | undefined {
    return markets.find(m => m.id === id);
  },

  placeBet(marketId: string, prediction: Prediction, amount: number): Bet | null {
    const market = markets.find(m => m.id === marketId);
    if (!market || market.status !== 'open') return null;

    const bet: Bet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      marketId,
      prediction,
      amount,
      timestamp: Date.now(),
    };

    if (prediction === 'UP') {
      market.totalUp += amount;
    } else {
      market.totalDown += amount;
    }

    bets.push(bet);
    notify();
    return bet;
  },

  getUserBets(): Bet[] {
    return [...bets].sort((a, b) => b.timestamp - a.timestamp);
  },

  getUserStats(): UserStats {
    const resolved = bets.filter(b => b.won !== undefined);
    const wins = resolved.filter(b => b.won).length;
    const totalStaked = bets.reduce((s, b) => s + b.amount, 0);
    const totalWon = bets.filter(b => b.won).reduce((s, b) => s + (b.payout || 0), 0);
    return {
      totalBets: bets.length,
      wins,
      losses: resolved.length - wins,
      totalStaked,
      totalWon,
      winRate: resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0,
    };
  },

  getLeaderboard(): LeaderboardEntry[] {
    // Simulated leaderboard
    const addresses = [
      'bc1q...a7f3', 'bc1q...k9d2', 'bc1q...m4e8', 'bc1q...p2c1',
      'bc1q...x5b7', 'bc1q...r8n4', 'bc1q...t3j6', 'bc1q...w1h9',
      'bc1q...v6g5', 'bc1q...s0f2',
    ];
    return addresses.map((addr, i) => {
      const wins = Math.max(50 - i * 4, 5) + Math.floor(Math.random() * 5);
      const totalBets = wins + Math.floor(Math.random() * 20) + 10;
      return {
        rank: i + 1,
        address: addr,
        wins,
        totalBets,
        winRate: Math.round((wins / totalBets) * 100),
        profit: Math.round((wins * 1500 - (totalBets - wins) * 800) + Math.random() * 10000),
      };
    }).sort((a, b) => b.profit - a.profit).map((e, i) => ({ ...e, rank: i + 1 }));
  },

  subscribe(cb: () => void): () => void {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter(l => l !== cb);
    };
  },

  destroy() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
    listeners = [];
    markets = [];
    bets = [];
    initialized = false;
  },
};
