import React from 'react';
import { formatAddress, formatSats } from '../utils';
import './Header.css';

export type Page = 'markets' | 'history' | 'leaderboard';

interface Props {
  connected: boolean;
  address: string | null;
  balance: number;
  isTestnet: boolean;
  network: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export const Header: React.FC<Props> = ({ connected, address, balance, isTestnet, network, onConnect, onDisconnect, currentPage, onNavigate }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo" onClick={() => onNavigate('markets')} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">₿</span>
          <span className="logo-text">
            Bitcoin<span className="logo-accent">Predict</span>
          </span>
        </div>
        <div className="header-badge">OP_NET</div>
        {connected && network && (
          <div className={`network-badge ${isTestnet ? 'testnet' : 'mainnet'}`}>
            {isTestnet ? '⚠ TESTNET' : network.toUpperCase()}
          </div>
        )}
      </div>

      <nav className="header-nav">
        <button className={`nav-link ${currentPage === 'markets' ? 'active' : ''}`} onClick={() => onNavigate('markets')}>Markets</button>
        <button className={`nav-link ${currentPage === 'history' ? 'active' : ''}`} onClick={() => onNavigate('history')}>History</button>
        <button className={`nav-link ${currentPage === 'leaderboard' ? 'active' : ''}`} onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
      </nav>

      <div className="header-right">
        {connected ? (
          <div className="wallet-info">
            <span className="wallet-status" />
            <div className="wallet-details">
              <span className="wallet-address">{formatAddress(address || '')}</span>
              <span className="wallet-bal">{formatSats(balance)} {isTestnet ? 'tBTC' : 'BTC'}</span>
            </div>
            <button className="disconnect-btn" onClick={onDisconnect}>✕</button>
          </div>
        ) : (
          <button className="connect-btn" onClick={onConnect}>
            <span className="connect-icon">⚡</span>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
};
