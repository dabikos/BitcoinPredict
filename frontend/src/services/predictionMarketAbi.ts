/**
 * PredictionMarket Contract ABI
 * 
 * AssemblyScript contract deployed on OP_NET Testnet.
 * After deploying the contract, set CONTRACT_ADDRESS below.
 */

import { ABIDataTypes } from '@btc-vision/transaction';
import { BitcoinAbiTypes } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';

// ─── Contract address (update after deployment) ───────────────────────────
export const PREDICTION_MARKET_ADDRESS = 'opt1sqr0574q8pkqkuvcnrzk08rnxe7p9zezycgh6e5cj';

// ─── Method selectors (for reference) ─────────────────────────────────────
export const SELECTORS = {
  createMarket: 'createMarket(uint8)',
  placeBet: 'placeBet(uint32,uint8)',
  resolveMarket: 'resolveMarket(uint32,uint64)',
  claimWinnings: 'claimWinnings(uint32)',
  getMarket: 'getMarket(uint32)',
  getUserBet: 'getUserBet(uint32,address)',
  getActiveMarkets: 'getActiveMarkets()',
};

// ─── Events ────────────────────────────────────────────────────────────────
export const PredictionMarketEvents: BitcoinInterfaceAbi = [
  {
    name: 'MarketCreated',
    values: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'duration', type: ABIDataTypes.UINT8 },
      { name: 'startTime', type: ABIDataTypes.UINT64 },
      { name: 'endTime', type: ABIDataTypes.UINT64 },
      { name: 'startPrice', type: ABIDataTypes.UINT64 },
    ],
    type: BitcoinAbiTypes.Event,
  },
  {
    name: 'BetPlaced',
    values: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'user', type: ABIDataTypes.ADDRESS },
      { name: 'direction', type: ABIDataTypes.UINT8 }, // 0=UP, 1=DOWN
      { name: 'amount', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Event,
  },
  {
    name: 'MarketResolved',
    values: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'endPrice', type: ABIDataTypes.UINT64 },
      { name: 'result', type: ABIDataTypes.UINT8 }, // 0=UP_WINS, 1=DOWN_WINS
    ],
    type: BitcoinAbiTypes.Event,
  },
  {
    name: 'WinningsClaimed',
    values: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'user', type: ABIDataTypes.ADDRESS },
      { name: 'payout', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Event,
  },
];

// ─── Full ABI ─────────────────────────────────────────────────────────────
export const PREDICTION_MARKET_ABI: BitcoinInterfaceAbi = [
  // Admin: create a new market
  {
    name: 'createMarket',
    inputs: [{ name: 'duration', type: ABIDataTypes.UINT8 }],
    outputs: [{ name: 'marketId', type: ABIDataTypes.UINT32 }],
    type: BitcoinAbiTypes.Function,
  },
  // User: place a bet (BTC sent via priorityFee = bet amount)
  {
    name: 'placeBet',
    inputs: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'direction', type: ABIDataTypes.UINT8 }, // 0=UP, 1=DOWN
    ],
    outputs: [],
    type: BitcoinAbiTypes.Function,
  },
  // Admin/Oracle: resolve a market with end price
  {
    name: 'resolveMarket',
    inputs: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'endPrice', type: ABIDataTypes.UINT64 },
    ],
    outputs: [],
    type: BitcoinAbiTypes.Function,
  },
  // User: claim winnings after market resolved
  {
    name: 'claimWinnings',
    inputs: [{ name: 'marketId', type: ABIDataTypes.UINT32 }],
    outputs: [{ name: 'payout', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  // Read: get market info
  {
    name: 'getMarket',
    inputs: [{ name: 'marketId', type: ABIDataTypes.UINT32 }],
    outputs: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'duration', type: ABIDataTypes.UINT8 },
      { name: 'startTime', type: ABIDataTypes.UINT64 },
      { name: 'endTime', type: ABIDataTypes.UINT64 },
      { name: 'startPrice', type: ABIDataTypes.UINT64 },
      { name: 'endPrice', type: ABIDataTypes.UINT64 },
      { name: 'status', type: ABIDataTypes.UINT8 }, // 0=open,1=locked,2=resolved
      { name: 'totalUp', type: ABIDataTypes.UINT256 },
      { name: 'totalDown', type: ABIDataTypes.UINT256 },
      { name: 'result', type: ABIDataTypes.UINT8 }, // 0=UP,1=DOWN,255=pending
    ],
    type: BitcoinAbiTypes.Function,
  },
  // Read: get user bet in a market
  {
    name: 'getUserBet',
    inputs: [
      { name: 'marketId', type: ABIDataTypes.UINT32 },
      { name: 'user', type: ABIDataTypes.ADDRESS },
    ],
    outputs: [
      { name: 'amount', type: ABIDataTypes.UINT256 },
      { name: 'direction', type: ABIDataTypes.UINT8 },
      { name: 'claimed', type: ABIDataTypes.BOOL },
    ],
    type: BitcoinAbiTypes.Function,
  },
  // Read: list all active market IDs
  {
    name: 'getActiveMarkets',
    inputs: [],
    outputs: [{ name: 'marketIds', type: ABIDataTypes.ARRAY_OF_UINT32 }],
    type: BitcoinAbiTypes.Function,
  },

  // Events
  ...PredictionMarketEvents,
];
