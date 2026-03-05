/**
 * createMarkets.ts — Call createMarket(5), createMarket(10), createMarket(15)
 *
 * Uses `getContract` from `opnet` (NOT @btc-vision/transaction for calls).
 * Pattern: getContract → simulate → sendTransaction (backend with real keypairs)
 *
 * Environment variables:
 *   PRIVATE_KEY_WIF   — WIF-encoded private key
 *   MLDSA_KEY_HEX     — ML-DSA quantum private key hex
 *   RPC_URL           — OP_NET RPC endpoint (default: https://testnet.opnet.org)
 *
 * Usage (PowerShell):
 *   $env:PRIVATE_KEY_WIF="cU6Y..."; $env:MLDSA_KEY_HEX="414e..."; npm run create-markets
 */

import { Wallet } from '@btc-vision/transaction';
import {
    ABIDataTypes,
    BitcoinAbiTypes,
    BitcoinInterfaceAbi,
    getContract,
    JSONRpcProvider,
    CallResult,
    BaseContractProperties,
} from 'opnet';
import { networks } from '@btc-vision/bitcoin';

// ─── Contract address (deployed) ──────────────────────────────────────────
const CONTRACT_ADDRESS = 'opt1sqr0574q8pkqkuvcnrzk08rnxe7p9zezycgh6e5cj';

// ─── Minimal ABI (only createMarket needed) ───────────────────────────────
const PREDICTION_MARKET_ABI: BitcoinInterfaceAbi = [
    {
        name: 'createMarket',
        type: BitcoinAbiTypes.Function,
        constant: false,
        inputs: [{ name: 'duration', type: ABIDataTypes.UINT8 }],
        outputs: [{ name: 'marketId', type: ABIDataTypes.UINT32 }],
    },
    // Need at least one event for ABI to be valid
    {
        name: 'MarketCreated',
        type: BitcoinAbiTypes.Event,
        values: [
            { name: 'marketId', type: ABIDataTypes.UINT32 },
            { name: 'duration', type: ABIDataTypes.UINT8 },
            { name: 'startTime', type: ABIDataTypes.UINT64 },
            { name: 'endTime', type: ABIDataTypes.UINT64 },
            { name: 'startPrice', type: ABIDataTypes.UINT64 },
        ],
    },
];

// ─── TypeScript interface ─────────────────────────────────────────────────
type CreateMarketResult = CallResult<{ marketId: bigint }, []>;

interface IPredictionMarket extends BaseContractProperties {
    createMarket(duration: number): Promise<CreateMarketResult>;
}

// ─── Config ───────────────────────────────────────────────────────────────
const CONFIG = {
    privateKeyWif: process.env.PRIVATE_KEY_WIF || '',
    mldsaKeyHex: process.env.MLDSA_KEY_HEX || '',
    rpcUrl: process.env.RPC_URL || 'https://testnet.opnet.org',
};

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    console.log('=== Create Prediction Markets ===\n');

    // 1. Validate env
    if (!CONFIG.privateKeyWif) {
        console.error('ERROR: Set PRIVATE_KEY_WIF environment variable.');
        process.exit(1);
    }
    if (!CONFIG.mldsaKeyHex) {
        console.error('ERROR: Set MLDSA_KEY_HEX environment variable.');
        process.exit(1);
    }

    const network = networks.opnetTestnet;

    // 2. Create wallet
    const wallet = Wallet.fromWif(CONFIG.privateKeyWif, CONFIG.mldsaKeyHex, network);
    console.log(`Wallet address: ${wallet.p2tr}`);

    // 3. Create provider
    const provider = new JSONRpcProvider({ url: CONFIG.rpcUrl, network });

    // 4. Get contract instance
    // wallet.address is already an Address instance (Uint8Array-based)
    const contract = getContract<IPredictionMarket>(
        CONTRACT_ADDRESS,
        PREDICTION_MARKET_ABI,
        provider,
        network,
        wallet.address,
    );

    console.log(`Contract: ${CONTRACT_ADDRESS}\n`);

    // 5. Create markets: 5min, 10min, 15min
    const durations = [5, 10, 15];

    for (const duration of durations) {
        console.log(`--- Creating ${duration}-minute market ---`);

        try {
            // Step 1: Simulate the call
            console.log(`  Simulating createMarket(${duration})...`);
            const simulation = await contract.createMarket(duration);

            // Check for simulation error
            if ('error' in simulation) {
                console.error(`  Simulation FAILED: ${(simulation as any).error}`);
                continue;
            }

            console.log(`  Simulation OK. Market ID from simulation: ${simulation.properties.marketId}`);

            // Step 2: Send the real transaction (backend: real keypairs)
            console.log(`  Sending transaction...`);
            const receipt = await simulation.sendTransaction({
                signer: wallet.keypair,
                mldsaSigner: wallet.mldsaKeypair,
                refundTo: wallet.p2tr,
                maximumAllowedSatToSpend: 10000n,
                network,
            });

            console.log(`  SUCCESS! TX: ${receipt.transactionId}`);
        } catch (err: any) {
            console.error(`  ERROR creating ${duration}m market:`, err.message || err);
        }

        // Wait between transactions for UTXO propagation
        if (duration !== durations[durations.length - 1]) {
            console.log('  Waiting 10s for UTXO propagation...\n');
            await sleep(10000);
        }
    }

    console.log('\n=== Done ===');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
