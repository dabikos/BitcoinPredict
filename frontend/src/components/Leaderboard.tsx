import React from 'react';
import { MarketService } from '../services/marketService';
import './Leaderboard.css';

export const Leaderboard: React.FC = () => {
  const entries = MarketService.getLeaderboard();

  return (
    <div className="leaderboard">
      <h3 className="lb-title">🏆 Top Predictors</h3>
      <div className="lb-table">
        <div className="lb-header">
          <span className="lb-col rank">#</span>
          <span className="lb-col address">Address</span>
          <span className="lb-col wins">W/L</span>
          <span className="lb-col rate">Win %</span>
          <span className="lb-col profit">Profit</span>
        </div>
        {entries.map(e => (
          <div key={e.rank} className={`lb-row ${e.rank <= 3 ? `top-${e.rank}` : ''}`}>
            <span className="lb-col rank">
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank}
            </span>
            <span className="lb-col address">{e.address}</span>
            <span className="lb-col wins">
              <span className="w">{e.wins}</span>/<span className="l">{e.totalBets - e.wins}</span>
            </span>
            <span className="lb-col rate">{e.winRate}%</span>
            <span className={`lb-col profit ${e.profit >= 0 ? 'positive' : 'negative'}`}>
              {e.profit >= 0 ? '+' : ''}{(e.profit / 1000).toFixed(1)}K
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
