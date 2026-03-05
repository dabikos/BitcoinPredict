import React, { useState } from 'react';
import { Prediction } from '../types';
import { MarketService } from '../services/marketService';
import { ContractService, MIN_BET, MAX_BET } from '../services/contractService';
import { formatSats, formatPrice } from '../utils';
import { PriceService } from '../services/priceService';
import { toast } from './Toast';
import './BetModal.css';

interface Props {
  marketId: string;
  prediction: Prediction;
  walletInstance: any;
  userAddress: string | null;
  userBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESETS = [5000, 10000, 50000, 100000];

export const BetModal: React.FC<Props> = ({ marketId, prediction, walletInstance, userAddress, userBalance, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(10000);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);

  const market = MarketService.getMarket(marketId);
  if (!market) return null;

  const totalPool = market.totalUp + market.totalDown + amount;
  const myPool = prediction === 'UP' ? market.totalUp + amount : market.totalDown + amount;
  const potentialMultiplier = myPool > 0 ? (totalPool / myPool).toFixed(2) : '—';
  const potentialPayout = myPool > 0 ? Math.round((amount / myPool) * totalPool) : 0;

  const insufficientBalance = amount > userBalance;
  const belowMin = amount < MIN_BET;

  const handlePlace = async () => {
    if (!walletInstance || !userAddress) {
      toast.error('Wallet not connected');
      return;
    }
    if (insufficientBalance) {
      toast.error('Insufficient tBTC balance');
      return;
    }

    setPlacing(true);
    try {
      // Call PredictionMarket smart contract via OPWallet Web3Provider
      const betTx = await ContractService.placeBet(
        walletInstance,
        marketId,
        prediction,
        amount,
        userAddress,
      );

      // Update local market state for immediate UI feedback
      MarketService.placeBet(marketId, prediction, amount);

      setTxId(betTx.txId);
      setSuccess(true);
      toast.success(`Bet confirmed! TX: ${betTx.txId.slice(0, 8)}...`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err: any) {
      const msg = err?.message || 'Transaction failed';
      if (msg.includes('User rejected') || msg.includes('cancel')) {
        toast.warning('Transaction cancelled by user');
      } else {
        toast.error(`Bet failed: ${msg}`);
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {success ? (
          <div className="modal-success">
            <div className="success-icon">✓</div>
            <h3>Prediction Placed!</h3>
            <p>{formatSats(amount)} tBTC on {prediction}</p>
            {txId && (
              <a
                className="tx-link"
                href={ContractService.getExplorerUrl(txId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Explorer →
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h3>Place Prediction</h3>
              <span className="modal-testnet-badge">TESTNET</span>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>

            <div className={`prediction-type ${prediction.toLowerCase()}`}>
              <span className="pred-arrow">{prediction === 'UP' ? '▲' : '▼'}</span>
              <span className="pred-text">BTC goes {prediction}</span>
              <span className="pred-duration">{market.duration} min</span>
            </div>

            <div className="current-price-info">
              <span>Entry Price</span>
              <span className="cp-value">{formatPrice(PriceService.getPrice())}</span>
            </div>

            <div className="wallet-balance-row">
              <span>Your Balance</span>
              <span className="balance-value">{formatSats(userBalance)} tBTC</span>
            </div>

            <div className="amount-section">
              <label className="amount-label">Bet Amount (satoshis)</label>
              <input
                type="number"
                className="amount-input"
                value={amount}
                onChange={e => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                min={MIN_BET}
                max={MAX_BET}
                step={1000}
              />
              <div className="amount-presets">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    className={`preset-btn ${amount === p ? 'active' : ''}`}
                    onClick={() => setAmount(p)}
                  >
                    {formatSats(p)}
                  </button>
                ))}
              </div>
              {insufficientBalance && (
                <div className="amount-error">Insufficient balance</div>
              )}
              {belowMin && !insufficientBalance && (
                <div className="amount-error">Min bet: {formatSats(MIN_BET)}</div>
              )}
            </div>

            <div className="payout-info">
              <div className="payout-row">
                <span>Multiplier</span>
                <span className="payout-value">{potentialMultiplier}x</span>
              </div>
              <div className="payout-row">
                <span>Potential Payout</span>
                <span className="payout-value highlight">{formatSats(potentialPayout)}</span>
              </div>
            </div>

            <button
              className={`place-btn ${prediction.toLowerCase()}`}
              onClick={handlePlace}
              disabled={placing || belowMin || insufficientBalance}
            >
              {placing ? (
                <>
                  <span className="spinner" />
                  <span>Confirm in wallet...</span>
                </>
              ) : (
                `Predict ${prediction} — ${formatSats(amount)} tBTC`
              )}
            </button>

            <div className="bet-disclaimer">
              Real tBTC transaction via OP_NET Smart Contract
            </div>
          </>
        )}
      </div>
    </div>
  );
};
