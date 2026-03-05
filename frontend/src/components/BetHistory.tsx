import React from 'react';
import { Bet, Market } from '../types';
import { MarketService } from '../services/marketService';
import { formatSats, formatTimeRemaining } from '../utils';
import { useNow } from '../hooks/usePrice';
import './BetHistory.css';

export const BetHistory: React.FC = () => {
  const now = useNow();
  const bets = MarketService.getUserBets();

  if (bets.length === 0) {
    return (
      <div className="bet-history-empty">
        <div className="empty-icon">📊</div>
        <h3>No Predictions Yet</h3>
        <p>Place your first prediction on an active market above!</p>
      </div>
    );
  }

  return (
    <div className="bet-history">
      <h3 className="history-title">Your Predictions</h3>
      <div className="history-list">
        {bets.map(bet => {
          const market = MarketService.getMarket(bet.marketId);
          const resolved = bet.won !== undefined;
          return (
            <div key={bet.id} className={`history-item ${resolved ? (bet.won ? 'won' : 'lost') : 'pending'}`}>
              <div className="history-row">
                <div className="history-left">
                  <span className={`history-pred ${bet.prediction.toLowerCase()}`}>
                    {bet.prediction === 'UP' ? '▲' : '▼'} {bet.prediction}
                  </span>
                  <span className="history-duration">{market?.duration || '?'}min</span>
                </div>
                <div className="history-right">
                  {resolved ? (
                    <span className={`history-result ${bet.won ? 'win' : 'loss'}`}>
                      {bet.won ? `+${formatSats(bet.payout! - bet.amount)}` : `-${formatSats(bet.amount)}`}
                    </span>
                  ) : (
                    <span className="history-pending">
                      {market ? formatTimeRemaining(market.endTime - now) : 'Pending'}
                    </span>
                  )}
                </div>
              </div>
              <div className="history-detail">
                <span>Staked: {formatSats(bet.amount)}</span>
                {resolved && <span>Payout: {formatSats(bet.payout || 0)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
