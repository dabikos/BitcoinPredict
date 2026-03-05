import React from 'react';
import { MarketService } from '../services/marketService';
import { OpnetService } from '../services/opnetService';
import { formatSats } from '../utils';
import type { WalletBalance } from '../hooks/usePrice';
import './UserStats.css';

interface Props {
  address: string | null;
  balance: number;
  walletBalance: WalletBalance | null;
  isTestnet: boolean;
}

export const UserStats: React.FC<Props> = ({ address, balance, walletBalance, isTestnet }) => {
  const stats = MarketService.getUserStats();
  const txCount = address ? OpnetService.getUserBetTxs(address).length : 0;
  const unit = isTestnet ? 'tBTC' : 'BTC';

  return (
    <div className="user-stats">
      <div className="stats-address">
        <div className="stats-addr-left">
          <span className="address-label">Connected</span>
          <span className="address-value">{address || '—'}</span>
        </div>
        {isTestnet && <span className="stats-testnet-badge">TESTNET</span>}
      </div>
      <div className="stats-grid">
        <div className="stat-item stat-highlight">
          <span className="stat-value">{formatSats(balance)} {unit}</span>
          <span className="stat-label">Balance</span>
          {walletBalance && (
            <span className="stat-sub">
              {walletBalance.confirmed > 0 && `${formatSats(walletBalance.confirmed)} confirmed`}
              {walletBalance.unconfirmed > 0 && ` + ${formatSats(walletBalance.unconfirmed)} pending`}
            </span>
          )}
        </div>
        <div className="stat-item">
          <span className="stat-value">{txCount > 0 ? txCount : stats.totalBets}</span>
          <span className="stat-label">On-chain Bets</span>
        </div>
        <div className="stat-item">
          <span className="stat-value stat-green">{stats.wins}</span>
          <span className="stat-label">Wins</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.winRate}%</span>
          <span className="stat-label">Win Rate</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatSats(stats.totalStaked)}</span>
          <span className="stat-label">Total Staked</span>
        </div>
        <div className="stat-item">
          <span className={`stat-value ${stats.totalWon >= stats.totalStaked ? 'stat-green' : 'stat-red'}`}>
            {formatSats(stats.totalWon)}
          </span>
          <span className="stat-label">Total Won</span>
        </div>
      </div>
    </div>
  );
};
