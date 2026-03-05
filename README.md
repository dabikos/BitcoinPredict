# BitcoinPredict

Prediction market platform for Bitcoin price on Layer 1 via **OP_NET**. Users predict whether BTC price goes UP or DOWN on 5, 10 and 15 minute markets. Think Polymarket, but native to Bitcoin.

## Features

- **Live BTC Price** — real-time price feed with auto-refresh
- **Prediction Markets** — 5 / 10 / 15 minute timeframes
- **UP/DOWN Bets** — place predictions via OPWallet
- **Countdown Timer** — per-market expiry countdown
- **Market History** — past markets and resolution results
- **Leaderboard** — top predictors ranking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | CSS Modules, dark theme |
| Wallet | OPWallet via `@btc-vision/walletconnect` |
| Provider | `JSONRpcProvider` from `opnet` |
| Smart Contracts | AssemblyScript (OP_NET) |

## Project Structure

```
frontend/        React app (Vite + TypeScript)
contracts/       Smart contract source (AssemblyScript)
  assembly/      Contract code
  abis/          ABI definitions
  build/         Compiled output
  scripts/       Deploy & market creation scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- [OPWallet](https://opnet.org) browser extension

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Contracts

```bash
cd contracts
npm install
npm run build
```

## Network

- **Testnet**: `https://testnet.opnet.org`

## License

MIT
