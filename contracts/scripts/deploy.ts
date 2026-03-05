/**
 * deploy.ts — Deploy PredictionMarket contract to OP_NET
 *
 * Based on official OPNet deployment documentation.
 *
 * Environment variables:
 *   PRIVATE_KEY_WIF   — WIF-encoded private key (testnet starts with 'c...')
 *   MLDSA_KEY_HEX     — ML-DSA quantum private key hex (REQUIRED)
 *   NETWORK           — "testnet" (default) or "mainnet"
 *   RPC_URL           — OP_NET RPC endpoint
 *   FEE_RATE          — Fee rate in sat/vB (default: 5)
 *   GAS_SAT_FEE       — Gas allocation in sats (default: 10000)
 *
 * Usage (PowerShell):
 *   $env:PRIVATE_KEY_WIF="cU6Y..."; $env:MLDSA_KEY_HEX="414e..."; npm run deploy
 */

import * as fs from 'fs';
import * as path from 'path';
import { IDeploymentParameters, TransactionFactory, Wallet } from '@btc-vision/transaction';
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

const CONFIG = {
    privateKeyWif: process.env.PRIVATE_KEY_WIF || '',
    mldsaKeyHex: process.env.MLDSA_KEY_HEX || '',
    network: (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet',
    rpcUrl: process.env.RPC_URL || 'https://testnet.opnet.org',
    feeRate: parseInt(process.env.FEE_RATE || '5'),
    gasSatFee: BigInt(process.env.GAS_SAT_FEE || '100000'),
    wasmPath: path.resolve(__dirname, '..', 'build', 'PredictionMarket.wasm'),
};

async function main(): Promise<void> {
    console.log('=== OP_NET Contract Deployment ===\n');

    // 1. Validate
    if (!CONFIG.privateKeyWif) {
        console.error('ERROR: Set PRIVATE_KEY_WIF environment variable.');
        console.error('  PowerShell: $env:PRIVATE_KEY_WIF="cN...your_key..."');
        process.exit(1);
    }
    if (!CONFIG.mldsaKeyHex) {
        console.error('ERROR: Set MLDSA_KEY_HEX environment variable.');
        console.error('  PowerShell: $env:MLDSA_KEY_HEX="414e...your_quantum_key..."');
        process.exit(1);
    }

    // 2. Check WASM file
    if (!fs.existsSync(CONFIG.wasmPath)) {
        console.error('ERROR: WASM file not found:', CONFIG.wasmPath);
        console.error('  Run "npm run build" first');
        process.exit(1);
    }

    const bytecode = new Uint8Array(fs.readFileSync(CONFIG.wasmPath));
    console.log(`Bytecode: ${CONFIG.wasmPath} (${bytecode.length} bytes)`);

    // 3. Setup network
    // CRITICAL: Use networks.opnetTestnet for OPNet testnet (Signet fork)
    // networks.testnet is Bitcoin Testnet4 — OPNet does NOT support it
    const network = CONFIG.network === 'mainnet'
        ? networks.bitcoin
        : networks.opnetTestnet;
    console.log(`Network: ${CONFIG.network} (bech32: ${network.bech32})`);
    console.log(`RPC: ${CONFIG.rpcUrl}`);

    // 4. Create wallet from WIF + ML-DSA key
    const wallet = Wallet.fromWif(CONFIG.privateKeyWif, CONFIG.mldsaKeyHex, network);
    const deployerAddress = wallet.p2tr;
    console.log(`Deployer address (p2tr): ${deployerAddress}`);

    // 5. Setup provider (object form per official docs)
    const provider = new JSONRpcProvider({ url: CONFIG.rpcUrl, network });

    // 6. Transaction factory
    const factory = new TransactionFactory();

    try {
        // 7. Get UTXOs
        console.log('\nFetching UTXOs...');
        const utxos = await provider.utxoManager.getUTXOs({
            address: deployerAddress,
        });
        if (utxos.length === 0) {
            throw new Error(`No UTXOs available. Fund address: ${deployerAddress}`);
        }
        console.log(`Found ${utxos.length} UTXOs`);

        // 8. Get challenge (PoW)
        console.log('Fetching epoch challenge...');
        const challenge = await provider.getChallenge();
        console.log('Challenge received');

        // 9. Sign deployment
        console.log('Signing deployment transaction...');
        const deploymentParams: IDeploymentParameters = {
            from: deployerAddress,
            utxos: utxos,
            signer: wallet.keypair,
            mldsaSigner: wallet.mldsaKeypair,
            network: network,
            feeRate: CONFIG.feeRate,
            priorityFee: 0n,
            gasSatFee: CONFIG.gasSatFee,
            bytecode: bytecode,
            challenge: challenge,
            linkMLDSAPublicKeyToAddress: true,
            revealMLDSAPublicKey: true,
        };

        const deployment = await factory.signDeployment(deploymentParams);

        console.log('\nDeployment transaction signed!');
        console.log('Contract Address:', deployment.contractAddress);

        // 10. Broadcast funding TX
        console.log('\nBroadcasting funding transaction...');
        const fundResult = await provider.sendRawTransaction(deployment.transaction[0], false);
        console.log('Funding TX ID:', fundResult);

        // 11. Broadcast reveal TX
        console.log('Broadcasting reveal transaction...');
        const revealResult = await provider.sendRawTransaction(deployment.transaction[1], false);
        console.log('Reveal TX ID:', revealResult);

        // 12. Save result
        const resultData = {
            contractAddress: deployment.contractAddress,
            network: CONFIG.network,
            deployerAddress,
            timestamp: new Date().toISOString(),
        };

        const buildDir = path.resolve(__dirname, '..', 'build');
        if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
        const outPath = path.resolve(buildDir, 'deployment.json');
        fs.writeFileSync(outPath, JSON.stringify(resultData, null, 2));
        console.log(`\nDeployment info saved to: ${outPath}`);

        console.log('\n=== Deployment Complete ===');
        console.log(`\nNext steps:`);
        console.log(`  1. Copy contract address: ${deployment.contractAddress}`);
        console.log(`  2. Paste into frontend/src/services/predictionMarketAbi.ts`);
        console.log(`  3. Call createMarket(5), createMarket(10), createMarket(15)`);

    } catch (error: any) {
        console.error('\nDeployment failed:', error.message || error);

        if (error.message?.includes('UTXO') || error.message?.includes('utxo') || error.message?.includes('No UTXOs')) {
            console.error(`\nYour wallet has no UTXOs. Fund this address first:`);
            console.error(`  ${deployerAddress}`);
        }

        process.exit(1);
    }
}

main().catch(console.error);
