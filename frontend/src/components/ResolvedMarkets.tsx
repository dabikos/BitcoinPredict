import React from 'react';
import { Market } from '../types';
import { MarketService } from '../services/marketService';
import { formatPrice, formatSats } from '../utils';
import './ResolvedMarkets.css';

export const ResolvedMarkets: React.FC = () => {
  const resolved = MarketService.getResolvedMarkets(20);

  if (resolved.length === 0) {
    return (
      <div className="resolved-empty">
        <div className="empty-icon">⏳</div>
        <h3>No Resolved Markets Yet</h3>
        <p>Markets will appear here once they complete their countdown</p>
      </div>
    );
  }

  return (
    <div className="resolved-markets">
      <h3 className="resolved-title">Resolved Markets</h3>
      <div className="resolved-list">
        {resolved.map(market => {
          const priceChange = market.endPrice! - market.startPrice;
          const pctChange = ((priceChange / market.startPrice) * 100).toFixed(3);
          const isUp = priceChange >= 0;
          const totalPool = market.totalUp + market.totalDown;
          const timeStr = new Date(market.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={market.id} className="resolved-item">
              <div className="resolved-row-top">
                <div className="resolved-left">
                  <span className="resolved-duration">{market.duration}MIN</span>
                  <span className="resolved-time">{timeStr}</span>
                </div>
                <div className={`resolved-result ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '🟢 UP' : '🔴 DOWN'}
                </div>
              </div>
              <div className="resolved-prices">
                <div className="resolved-price-item">
                  <span className="rp-label">Open</span>
                  <span className="rp-value">{formatPrice(market.startPrice)}</span>
                </div>
                <div className="resolved-arrow">{isUp ? '▲' : '▼'}</div>
                <div className="resolved-price-item">
                  <span className="rp-label">Close</span>
                  <span className={`rp-value ${isUp ? 'text-green' : 'text-red'}`}>{formatPrice(market.endPrice!)}</span>
                </div>
              </div>
              <div className="resolved-footer">
                <span className={`resolved-change ${isUp ? 'text-green' : 'text-red'}`}>
                  {isUp ? '+' : ''}{pctChange}%
                </span>
                <span className="resolved-pool">Pool: {formatSats(totalPool)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
