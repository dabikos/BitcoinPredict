export type MarketDuration = 5 | 10 | 15;
export type Prediction = 'UP' | 'DOWN';
export type MarketStatus = 'open' | 'locked' | 'resolved';

export interface Market {
  id: string;
  duration: MarketDuration;
  startTime: number;       // unix ms
  lockTime: number;        // unix ms — when betting closes (30s before end)
  endTime: number;         // unix ms
  startPrice: number;      // BTC price at start
  endPrice?: number;       // BTC price at resolution
  status: MarketStatus;
  totalUp: number;         // total staked on UP (sats)
  totalDown: number;       // total staked on DOWN (sats)
  result?: Prediction;     // resolved direction
}

export interface Bet {
  id: string;
  marketId: string;
  prediction: Prediction;
  amount: number;           // sats
  timestamp: number;
  payout?: number;          // if resolved
  won?: boolean;
}

export interface UserStats {
  totalBets: number;
  wins: number;
  losses: number;
  totalStaked: number;
  totalWon: number;
  winRate: number;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  wins: number;
  totalBets: number;
  winRate: number;
  profit: number;
}

export interface PricePoint {
  time: number;
  price: number;
}
