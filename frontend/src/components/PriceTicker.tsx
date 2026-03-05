import React, { useState, useEffect } from 'react';
import { usePrice } from '../hooks/usePrice';
import { PriceChart } from './PriceChart';
import { PriceService } from '../services/priceService';
import { formatPrice, formatPriceChange } from '../utils';
import './PriceTicker.css';

export const PriceTicker: React.FC = () => {
  const { price, prevPrice, history } = usePrice();
  const [isLive, setIsLive] = useState(PriceService.isLive());
  const change = formatPriceChange(price, prevPrice);
  const isFlash = price !== prevPrice;

  useEffect(() => {
    const id = setInterval(() => setIsLive(PriceService.isLive()), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="price-ticker">
      <div className="ticker-header">
        <div className="ticker-label">
          <span className="btc-icon">₿</span>
          <span>BTC / USD</span>
        </div>
        <div className={`ticker-live ${isLive ? '' : 'simulated'}`}>
          <span className="live-dot" />
          {isLive ? 'LIVE' : 'SIMULATED'}
        </div>
      </div>
      <div className={`ticker-price ${isFlash ? (change.positive ? 'flash-green' : 'flash-red') : ''}`}>
        {formatPrice(price)}
      </div>
      <div className={`ticker-change ${change.positive ? 'positive' : 'negative'}`}>
        {change.text}
      </div>
      <PriceChart data={history} />
    </div>
  );
};
