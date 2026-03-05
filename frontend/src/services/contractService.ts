/**
 * Contract Interaction Service
 *
 * Uses wallet.web3.signAndBroadcastInteraction() (OPWallet Web3Provider API)
 * to place bets by calling the PredictionMarket smart contract.
 *
 * - placeBet: sends BTC to contract via priorityFee (bet amount in satoshis)
 * - claimWinnings: calls contract to receive payout
 * - Reads market state from contract via JSONRpcProvider
 */

import { networks } from '@btc-vision/bitcoin';
import { ABIDataTypes, BinaryWriter, ABICoder } from '@btc-vision/transaction';
import { JSONRpcProvider, IBaseContract, BitcoinInterface } from 'opnet';
import type { InteractionParametersWithoutSigner } from '@btc-vision/transaction';
import type { Prediction } from '../types';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from './predictionMarketAbi';

export const OPNET_TESTNET_RPC = 'https://testnet.opnet.org';
export const MIN_BET = 1000;
export const MAX_BET = 10_000_000;

// ─── Read-only provider ────────────────────────────────────────────────────
let _provider: JSONRpcProvider | null = null;
function getProvider(): JSONRpcProvider {
  if (!_provider) {
    _provider = new JSONRpcProvider(OPNET_TESTNET_RPC, networks.testnet);
  }
  return _provider;
}

// ─── Contract instance for encoding / reading ─────────────────────────────
let _contract: IBaseContract<any> | null = null;
function getContract(): IBaseContract<any> {
  if (!_contract) {
    _contract = new IBaseContract(
      PREDICTION_MARKET_ADDRESS,
      BitcoinInterface.from(PREDICTION_MARKET_ABI),
      getProvider(),
      networks.testnet,
    ) as any;
  }
  return _contract;
}

// ─── UTXO fetching ─────────────────────────────────────────────────────────
interface RawUTXOEntry {
  transactionId: string;
  outputIndex: number;
  value: string;
  scriptPubKey: { hex: string; address: string };
  raw?: number;
}
interface UTXOResponse {
  confirmed: RawUTXOEntry[];
  pending: RawUTXOEntry[];
  spentTransactions: RawUTXOEntry[];
  raw: string[];
}

async function fetchUTXOs(address: string): Promise<any[]> {
  const url = `${OPNET_TESTNET_RPC}/api/v1/address/utxos?address=${encodeURIComponent(address)}&optimize=true`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`UTXO fetch failed: ${resp.statusText}`);
  const data: UTXOResponse = await resp.json();

  const rawTxs = data.raw ?? [];
  const spentSet = new Set(
    (data.spentTransactions ?? []).map(s => `${s.transactionId}:${s.outputIndex}`)
  );
  const all = [...(data.confirmed ?? []), ...(data.pending ?? [])];
  const unspent = all.filter(u => !spentSet.has(`${u.transactionId}:${u.outputIndex}`));

  return unspent.map(u => ({
    transactionId: u.transactionId,
    outputIndex: u.outputIndex,
    value: BigInt(u.value),
    scriptPubKey: u.scriptPubKey,
    rawTransaction: u.raw !== undefined && rawTxs[u.raw]
      ? Buffer.from(rawTxs[u.raw], 'base64').toString('hex')
      : undefined,
  }));
}

// ─── Gas params ────────────────────────────────────────────────────────────
async function getGasParams(): Promise<{ feeRate: number; gasSatFee: bigint }> {
  try {
    const params = await getProvider().gasParameters();
    return {
      feeRate: params.baseGas ? Number(params.baseGas) : 50,
      gasSatFee: params.gasSatFee ?? 300n,
    };
  } catch {
    return { feeRate: 50, gasSatFee: 300n };
  }
}

// ─── Interaction helper ────────────────────────────────────────────────────

async function callContractMethod(
  wallet: any,
  fromAddress: string,
  methodName: string,
  args: unknown[],
  valueSats: bigint = 0n,
): Promise<string> {
  if (!wallet?.web3?.signAndBroadcastInteraction) {
    throw new Error('OPWallet Web3Provider not available. Make sure OPWallet is installed and connected.');
  }

  const contract = getContract();
  const calldata = (contract as any).encodeCalldata(methodName, args);

  const utxos = await fetchUTXOs(fromAddress);
  if (utxos.length === 0) throw new Error('No UTXOs available. Get testnet BTC from a faucet.');

  const { feeRate, gasSatFee } = await getGasParams();

  const interactionParams: InteractionParametersWithoutSigner = {
    to: PREDICTION_MARKET_ADDRESS,
    calldata,
    utxos,
    feeRate,
    priorityFee: valueSats,  // BTC sent to contract (bet amount)
    gasSatFee,
    from: fromAddress,
  };

  const [fundingTx, interactionTx] = await wallet.web3.signAndBroadcastInteraction(interactionParams);

  if (!fundingTx.success) throw new Error(`Funding TX failed: ${fundingTx.error}`);
  if (!interactionTx.success) throw new Error(`Interaction TX failed: ${interactionTx.error}`);

  return interactionTx.result ?? fundingTx.result ?? 'confirmed';
}

// ─── Market data types ─────────────────────────────────────────────────────
export interface ContractMarket {
  marketId: number;
  duration: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  status: 0 | 1 | 2;       // 0=open, 1=locked, 2=resolved
  totalUp: bigint;
  totalDown: bigint;
  result: 0 | 1 | 255;     // 0=UP_wins, 1=DOWN_wins, 255=pending
}

export interface ContractBet {
  amount: bigint;
  direction: 0 | 1;  // 0=UP, 1=DOWN
  claimed: boolean;
}

export interface BetTransaction {
  txId: string;
  marketId: string;
  prediction: Prediction;
  amount: number;
  timestamp: number;
  address: string;
  simulated?: boolean;
}

const STORAGE_KEY = 'bitcoinpredict_bets_v2';
function loadBetTxs(): BetTransaction[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveBetTxs(txs: BetTransaction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

// ─── Public API ────────────────────────────────────────────────────────────
export const ContractService = {
  /**
   * Place a bet via OP_NET contract interaction.
   * Uses wallet.web3.signAndBroadcastInteraction().
   * The bet amount (satoshis) is passed as priorityFee → Blockchain.value in contract.
   */
  async placeBet(
    wallet: any,
    marketId: string,
    prediction: Prediction,
    amount: number,
    userAddress: string,
  ): Promise<BetTransaction> {
    if (amount < MIN_BET) throw new Error(`Minimum bet: ${MIN_BET} sats`);
    if (amount > MAX_BET) throw new Error(`Maximum bet: ${MAX_BET} sats`);

    if (PREDICTION_MARKET_ADDRESS === 'DEPLOY_CONTRACT_FIRST') {
      throw new Error('Smart contract not deployed yet. Set PREDICTION_MARKET_ADDRESS in predictionMarketAbi.ts');
    }

    const direction = prediction === 'UP' ? 0 : 1;
    const marketIdNum = parseInt(marketId.split('_')[1] ?? '0', 10);

    const txId = await callContractMethod(
      wallet,
      userAddress,
      'placeBet',
      [marketIdNum, direction],
      BigInt(amount),
    );

    const betTx: BetTransaction = {
      txId,
      marketId,
      prediction,
      amount,
      timestamp: Date.now(),
      address: userAddress,
      simulated: false,
    };

    const txs = loadBetTxs();
    txs.push(betTx);
    saveBetTxs(txs);

    return betTx;
  },

  /**
   * Claim winnings from a resolved market.
   */
  async claimWinnings(
    wallet: any,
    marketId: number,
    userAddress: string,
  ): Promise<string> {
    return callContractMethod(wallet, userAddress, 'claimWinnings', [marketId], 0n);
  },

  /**
   * Read market data from the contract (read-only, no wallet needed).
   */
  async getMarket(marketId: number): Promise<ContractMarket | null> {
    try {
      const contract = getContract() as any;
      const result = await contract.getMarket(marketId);
      if (!result) return null;
      return {
        marketId: Number(result.marketId),
        duration: Number(result.duration),
        startTime: Number(result.startTime) * 1000,
        endTime: Number(result.endTime) * 1000,
        startPrice: Number(result.startPrice),
        endPrice: Number(result.endPrice),
        status: Number(result.status) as 0 | 1 | 2,
        totalUp: BigInt(result.totalUp ?? 0),
        totalDown: BigInt(result.totalDown ?? 0),
        result: Number(result.result) as 0 | 1 | 255,
      };
    } catch {
      return null;
    }
  },

  /**
   * Read user's bet from the contract.
   */
  async getUserBet(marketId: number, userAddress: string): Promise<ContractBet | null> {
    try {
      const contract = getContract() as any;
      const result = await contract.getUserBet(marketId, userAddress);
      if (!result) return null;
      return {
        amount: BigInt(result.amount ?? 0),
        direction: Number(result.direction) as 0 | 1,
        claimed: Boolean(result.claimed),
      };
    } catch {
      return null;
    }
  },

  /**
   * Get list of active market IDs from the contract.
   */
  async getActiveMarketIds(): Promise<number[]> {
    try {
      const contract = getContract() as any;
      const result = await contract.getActiveMarkets();
      return (result?.marketIds ?? []).map(Number);
    } catch {
      return [];
    }
  },

  getUserBetTxs(userAddress: string): BetTransaction[] {
    return loadBetTxs().filter(tx => tx.address === userAddress);
  },

  getMarketBetTxs(marketId: string): BetTransaction[] {
    return loadBetTxs().filter(tx => tx.marketId === marketId);
  },

  getExplorerUrl(txId: string): string {
    return `https://mempool.space/testnet4/tx/${txId}`;
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
