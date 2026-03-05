import React, { useState, useEffect } from 'react';
import { Market, Prediction } from '../types';
import { MarketService } from '../services/marketService';
import { PriceService } from '../services/priceService';
import { formatTimeRemaining, formatSats, formatPrice, formatPriceChange } from '../utils';
import { PriceChart } from './PriceChart';
import { useMarketTimer } from '../hooks/usePrice';
import './MarketCard.css';

interface Props {
  market: Market;
  onBet: (marketId: string, prediction: Prediction) => void;
  walletConnected: boolean;
}

export const MarketCard: React.FC<Props> = ({ market, onBet, walletConnected }) => {
  const remaining = useMarketTimer(market.endTime);
  const lockRemaining = useMarketTimer(market.lockTime);
  const [currentPrice, setCurrentPrice] = useState(PriceService.getPrice());
  const [chartData, setChartData] = useState(PriceService.getHistoryForDuration(market.duration));

  useEffect(() => {
    const unsub = PriceService.subscribe((price) => {
      setCurrentPrice(price);
      setChartData(PriceService.getHistoryForDuration(market.duration));
    });
    return unsub;
  }, [market.duration]);

  const totalPool = market.totalUp + market.totalDown;
  const upPct = totalPool > 0 ? Math.round((market.totalUp / totalPool) * 100) : 50;
  const downPct = 100 - upPct;
  const upMultiplier = market.totalUp > 0 ? (totalPool / market.totalUp).toFixed(2) : '—';
  const downMultiplier = market.totalDown > 0 ? (totalPool / market.totalDown).toFixed(2) : '—';

  const priceChange = formatPriceChange(currentPrice, market.startPrice);
  const isLocked = market.status === 'locked';
  const isResolved = market.status === 'resolved';

  const urgency = remaining < 60000 ? 'urgent' : remaining < 120000 ? 'warning' : '';

  return (
    <div className={`market-card ${isResolved ? 'resolved' : ''} ${isLocked ? 'locked' : ''}`}>
      {/* Header */}
      <div className="market-header">
        <div className="market-duration">
          <span className="duration-badge">{market.duration}MIN</span>
          <span className={`market-status status-${market.status}`}>
            {isResolved ? 'RESOLVED' : isLocked ? 'LOCKED' : 'LIVE'}
          </span>
        </div>
        <div className={`market-timer ${urgency}`}>
          {isResolved ? 'ENDED' : formatTimeRemaining(remaining)}
        </div>
      </div>

      {/* Price Info */}
      <div className="market-prices">
        <div className="price-row">
          <span className="price-label">Entry Price</span>
          <span className="price-value">{formatPrice(market.startPrice)}</span>
        </div>
        <div className="price-row">
          <span className="price-label">Current</span>
          <span className={`price-value ${priceChange.positive ? 'text-green' : 'text-red'}`}>
            {isResolved ? formatPrice(market.endPrice!) : formatPrice(currentPrice)}
          </span>
        </div>
        <div className={`price-direction ${priceChange.positive ? 'dir-up' : 'dir-down'}`}>
          {priceChange.positive ? '▲' : '▼'} {priceChange.text}
        </div>
      </div>

      {/* Mini Chart */}
      <PriceChart data={chartData} height={100} startPrice={market.startPrice} />

      {/* Pool Info */}
      <div className="pool-info">
        <div className="pool-bar">
          <div className="pool-up" style={{ width: `${upPct}%` }}>
            {upPct}%
          </div>
          <div className="pool-down" style={{ width: `${downPct}%` }}>
            {downPct}%
          </div>
        </div>
        <div className="pool-details">
          <div className="pool-side up">
            <span className="pool-label">UP</span>
            <span className="pool-amount">{formatSats(market.totalUp)}</span>
            <span className="pool-multi">{upMultiplier}x</span>
          </div>
          <div className="pool-total">
            Pool: {formatSats(totalPool)}
          </div>
          <div className="pool-side down">
            <span className="pool-multi">{downMultiplier}x</span>
            <span className="pool-amount">{formatSats(market.totalDown)}</span>
            <span className="pool-label">DOWN</span>
          </div>
        </div>
      </div>

      {/* Result Badge */}
      {isResolved && market.result && (
        <div className={`result-badge result-${market.result.toLowerCase()}`}>
          {market.result === 'UP' ? '🟢 UP WINS' : '🔴 DOWN WINS'}
        </div>
      )}

      {/* Bet Buttons */}
      {!isResolved && (
        <div className="bet-buttons">
          <button
            className="bet-btn bet-up"
            onClick={() => onBet(market.id, 'UP')}
            disabled={isLocked || !walletConnected}
          >
            <span className="bet-arrow">▲</span>
            <span className="bet-label">UP</span>
            <span className="bet-multi">{upMultiplier}x</span>
          </button>
          <button
            className="bet-btn bet-down"
            onClick={() => onBet(market.id, 'DOWN')}
            disabled={isLocked || !walletConnected}
          >
            <span className="bet-arrow">▼</span>
            <span className="bet-label">DOWN</span>
            <span className="bet-multi">{downMultiplier}x</span>
          </button>
        </div>
      )}

      {!walletConnected && !isResolved && (
        <div className="connect-hint">Connect wallet to place predictions</div>
      )}

      {isLocked && !isResolved && (
        <div className="locked-hint">🔒 Betting closed — resolving in {formatTimeRemaining(remaining)}</div>
      )}
    </div>
  );
};
