# CLAUDE.md — BitcoinPredict (OP_NET Prediction Markets)

## Project Description

BitcoinPredict — платформа предсказаний цены Bitcoin на Layer 1 через OP_NET.
Пользователи делают прогнозы «вверх/вниз» на 5, 10 и 15 минутных рынках.
Аналог Polymarket, но для Bitcoin-рынков.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: CSS Modules, dark theme
- **Wallet**: OPWallet via @btc-vision/walletconnect
- **Provider**: JSONRpcProvider from opnet (separate for reads)
- **Smart Contracts**: AssemblyScript (OP_NET)

## Project Structure

```
/frontend        -- React frontend (Vite + TS)
/shared          -- Shared types, ABIs, constants
/contracts       -- Smart contract source (AssemblyScript)
CLAUDE.md        -- This file
```

## Package Rules

### ALWAYS Use
- `@btc-vision/bitcoin` — Bitcoin library (OPNet fork)
- `@btc-vision/transaction` — Transaction construction and ABI types
- `opnet` — OPNet SDK, provider, contract interaction
- `@btc-vision/walletconnect` — Wallet connection modal

### NEVER Use
- `bitcoinjs-lib` — wrong Bitcoin library
- `ecpair` — wrong EC pair library
- `ethers` or `web3` — Ethereum libraries
- `express`, `fastify`, `koa` — wrong backend framework
- MetaMask — NEVER, only OPWallet

## Frontend Rules

- OPWallet ONLY for wallet connection
- Separate JSONRpcProvider for read operations
- Testnet: https://testnet.opnet.org
- Dark theme, orange accents, responsive
- TypeScript, React functional components
- Loading states, error handling, success feedback

## Key Features

1. Живая цена BTC с автообновлением
2. Рынки прогнозов на 5/10/15 минут
3. Ставки UP/DOWN с подключением OPWallet
4. Таймер обратного отсчёта для каждого рынка
5. История прошлых рынков и результатов
6. Лидерборд лучших предсказателей
