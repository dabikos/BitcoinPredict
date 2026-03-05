import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Market, Prediction } from './types';
import { PriceService } from './services/priceService';
import { MarketService } from './services/marketService';
import { Header, Page } from './components/Header';
import { PriceTicker } from './components/PriceTicker';
import { MarketCard } from './components/MarketCard';
import { BetModal } from './components/BetModal';
import { BetHistory } from './components/BetHistory';
import { UserStats } from './components/UserStats';
import { Leaderboard } from './components/Leaderboard';
import { ResolvedMarkets } from './components/ResolvedMarkets';
import { ToastContainer, toast } from './components/Toast';
import { useWallet } from './hooks/usePrice';
import { formatPrice } from './utils';
import './App.css';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [betModal, setBetModal] = useState<{ marketId: string; prediction: Prediction } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState<Page>('markets');
  const resolvedIds = useRef<Set<string>>(new Set());
  const wallet = useWallet();

  // Initialize services
  useEffect(() => {
    async function init() {
      await PriceService.init();
      MarketService.init();
      setInitialized(true);
    }
    init();
    return () => {
      PriceService.destroy();
      MarketService.destroy();
    };
  }, []);

  // Subscribe to market changes
  useEffect(() => {
    if (!initialized) return;
    const update = () => {
      setMarkets(MarketService.getActiveMarkets());
      setRefreshKey(k => k + 1);

      // Check for newly resolved markets and show toast
      const resolved = MarketService.getResolvedMarkets(5);
      resolved.forEach(m => {
        if (!resolvedIds.current.has(m.id)) {
          resolvedIds.current.add(m.id);
          // Skip toasting the very first batch (existing resolved markets on init)
          if (resolvedIds.current.size > resolved.length) {
            const emoji = m.result === 'UP' ? '🟢' : '🔴';
            toast.info(`${emoji} ${m.duration}MIN market resolved ${m.result} at ${formatPrice(m.endPrice!)}`);
          }
        }
      });
    };
    // Seed resolved IDs so we don't toast on initial load
    MarketService.getResolvedMarkets(50).forEach(m => resolvedIds.current.add(m.id));
    update();
    const unsub = MarketService.subscribe(update);
    const interval = setInterval(update, 2000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [initialized]);

  // ─── (no simulated bets from other users) ─────────────────────────────

  const handleBet= useCallback((marketId: string, prediction: Prediction) => {
    if (!wallet.connected) {
      wallet.connect();
      return;
    }
    setBetModal({ marketId, prediction });
  }, [wallet]);

  if (!initialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <span>Initializing BitcoinPredict...</span>
      </div>
    );
  }

  return (
    <div className="app">
      {wallet.isTestnet && (
        <div className="testnet-banner">
          ⚠ OP_NET Testnet — Using tBTC test tokens. Not real funds.
        </div>
      )}
      <div className="container">
        <Header
          connected={wallet.connected}
          address={wallet.address}
          balance={wallet.balance}
          isTestnet={wallet.isTestnet}
          network={wallet.network}
          onConnect={wallet.connect}
          onDisconnect={wallet.disconnect}
          currentPage={page}
          onNavigate={setPage}
        />

        {/* === Markets Page === */}
        {page === 'markets' && (
          <>
            <div className="hero">
              <h1 className="hero-title">
                Predict Bitcoin. <span className="hero-accent">Win Bitcoin.</span>
              </h1>
              <p className="hero-sub">
                5, 10, and 15 minute prediction markets — powered by OP_NET on Bitcoin Layer 1
              </p>
            </div>

            <PriceTicker />

            <section className="section">
              <div className="section-header">
                <h2 className="section-title">🔥 Active Markets</h2>
                <div className="market-filters">
                  <span className="filter-label">All timeframes</span>
                </div>
              </div>
              <div className="markets-grid">
                {markets.map(market => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    onBet={handleBet}
                    walletConnected={wallet.connected}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* === History Page === */}
        {page === 'history' && (
          <div className="page-content">
            <div className="page-header">
              <h1 className="page-title">📊 Prediction History</h1>
              <p className="page-subtitle">Your past predictions and results</p>
            </div>
            {wallet.connected && (
              <UserStats
                address={wallet.address}
                balance={wallet.balance}
                walletBalance={wallet.walletBalance}
                isTestnet={wallet.isTestnet}
              />
            )}
            <BetHistory key={refreshKey} />
            <ResolvedMarkets />
            {!wallet.connected && (
              <div className="connect-prompt">
                <p>Connect your wallet to see your prediction history</p>
                <button className="connect-btn-inline" onClick={() => wallet.connect()}>
                  ⚡ Connect OPWallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* === Leaderboard Page === */}
        {page === 'leaderboard' && (
          <div className="page-content">
            <div className="page-header">
              <h1 className="page-title">🏆 Leaderboard</h1>
              <p className="page-subtitle">Top predictors ranked by profit</p>
            </div>
            <Leaderboard />
          </div>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-brand">
            <span className="footer-icon">₿</span> BitcoinPredict
          </div>
          <div className="footer-links">
            <span>Built on OP_NET</span>
            <span>•</span>
            <span>Bitcoin Layer 1</span>
            <span>•</span>
            <a href="https://opnet.org" target="_blank" rel="noopener">opnet.org</a>
          </div>
          <div className="footer-copy">© 2026 BitcoinPredict. Powered by OP_NET.</div>
        </footer>
      </div>

      {/* Bet Modal */}
      {betModal && (
        <BetModal
          marketId={betModal.marketId}
          prediction={betModal.prediction}
          walletInstance={wallet.walletInstance}
          userAddress={wallet.address}
          userBalance={wallet.balance}
          onClose={() => setBetModal(null)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default App;
