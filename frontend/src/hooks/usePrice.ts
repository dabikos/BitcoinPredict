import { useState, useEffect, useCallback } from 'react';
import { PriceService } from '../services/priceService';
import { PricePoint } from '../types';
import { useWalletConnect } from '@btc-vision/walletconnect';
import type { WalletBalance } from '@btc-vision/walletconnect';

export type { WalletBalance };

export function usePrice() {
  const [price, setPrice] = useState<number>(PriceService.getPrice());
  const [prevPrice, setPrevPrice] = useState<number>(price);
  const [history, setHistory] = useState<PricePoint[]>(PriceService.getHistory());

  useEffect(() => {
    const unsub = PriceService.subscribe((newPrice) => {
      setPrevPrice(prev => prev);
      setPrice(current => {
        setPrevPrice(current);
        return newPrice;
      });
      setHistory(PriceService.getHistory());
    });
    return unsub;
  }, []);

  return { price, prevPrice, history };
}

export function useMarketTimer(endTime: number) {
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, endTime - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [endTime]);

  return remaining;
}

export function useWallet() {
  const {
    openConnectModal,
    disconnect,
    walletAddress,
    walletBalance,
    walletInstance,
    provider,
    signer,
    connecting,
    network,
  } = useWalletConnect();

  const connected = !!walletAddress;
  const address = walletAddress || null;
  const balance = walletBalance?.total ?? 0;

  const connect = useCallback(async () => {
    openConnectModal();
  }, [openConnectModal]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return {
    connected,
    connecting,
    address,
    balance,
    walletBalance: walletBalance || null,
    walletInstance: walletInstance || null,
    provider: provider || null,
    signer: signer || null,
    network: network?.network ?? null,
    isTestnet: network?.network === 'testnet',
    connect,
    disconnect: handleDisconnect,
  };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
