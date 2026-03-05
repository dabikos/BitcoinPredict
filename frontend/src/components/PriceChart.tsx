import React from 'react';
import { PricePoint } from '../types';
import './PriceChart.css';

interface Props {
  data: PricePoint[];
  width?: number;
  height?: number;
  startPrice?: number;
}

export const PriceChart: React.FC<Props> = ({ data, width = 600, height = 200, startPrice }) => {
  if (data.length < 2) return <div className="chart-empty">Loading chart...</div>;

  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = 10;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - ((d.price - min) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  // Gradient fill
  const firstPoint = `${padding},${padding + chartH}`;
  const lastPoint = `${padding + chartW},${padding + chartH}`;
  const areaPoints = `${firstPoint} ${points} ${lastPoint}`;

  const lastPrice = prices[prices.length - 1];
  const isUp = startPrice ? lastPrice >= startPrice : lastPrice >= prices[0];

  // Start price line
  let startLineY: number | null = null;
  if (startPrice && startPrice >= min && startPrice <= max) {
    startLineY = padding + chartH - ((startPrice - min) / range) * chartH;
  }

  return (
    <div className="price-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id={`grad-${isUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#00d4aa' : '#ff4757'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? '#00d4aa' : '#ff4757'} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={`url(#grad-${isUp ? 'up' : 'down'})`}
        />

        {/* Start price line */}
        {startLineY !== null && (
          <line
            x1={padding}
            y1={startLineY}
            x2={padding + chartW}
            y2={startLineY}
            stroke="#ffffff20"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Price line */}
        <polyline
          points={points}
          fill="none"
          stroke={isUp ? '#00d4aa' : '#ff4757'}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current price dot */}
        <circle
          cx={padding + chartW}
          cy={padding + chartH - ((lastPrice - min) / range) * chartH}
          r="4"
          fill={isUp ? '#00d4aa' : '#ff4757'}
          className="pulse-dot"
        />
      </svg>
    </div>
  );
};
