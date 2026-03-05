# Деплой PredictionMarket на OP_NET Testnet

## 1. Установить зависимости

```bash
cd D:\OpNET\contracts
npm install
```

## 2. Собрать контракт

```bash
npm run build
# → создаёт build/PredictionMarket.wasm
```

## 3. Задеплоить контракт

В OP_NET нет CLI — деплой делается **программно** через `@btc-vision/transaction`.

### Вариант A: Скрипт (Node.js)

```bash
# Установить ts-node если ещё нет
npm install -g ts-node

# Задать приватный ключ (WIF, testnet начинается с 'c...')
# ⚠️ Ключ должен иметь tBTC на балансе!
set PRIVATE_KEY_WIF=cN...ваш_приватный_ключ...

# Запустить деплой
npx ts-node scripts/deploy.ts
```

Скрипт:
1. Прочитает `build/PredictionMarket.wasm`
2. Получит challenge от ноды
3. Подпишет и отправит funding + deployment транзакции
4. Выведет адрес контракта и сохранит в `build/deployment.json`

> **⚠️ ML-DSA ключ**: Деплой требует квантово-устойчивый ML-DSA ключ.
> Если его нет — используйте Вариант B (OPWallet).

### Вариант B: Через OPWallet (рекомендуется)

OPWallet автоматически обрабатывает ML-DSA подписи:

```typescript
// В браузере с расширением OPWallet
import { TransactionFactory } from '@btc-vision/transaction';
import { JSONRpcProvider } from 'opnet';

const provider = new JSONRpcProvider('https://testnet.opnet.org');
const factory = new TransactionFactory();
const bytecode = await fetch('/PredictionMarket.wasm').then(r => r.arrayBuffer());

const challenge = await provider.getChallenge();
const result = await factory.signDeployment({
    network: 'testnet',
    bytecode: Buffer.from(bytecode),
    challenge,
    feeRate: 10,
    priorityFee: 10000n,
    gasSatFee: 500n,
    // OPWallet подпишет автоматически через window.opnet.web3
});

console.log('Contract:', result.contractAddress);
```

После деплоя получишь адрес контракта вида: `bcrt1p...` или `tb1p...`

## 4. Обновить адрес контракта в frontend

Открой файл:
```
D:\OpNET\frontend\src\services\predictionMarketAbi.ts
```

Найди строку:
```ts
export const PREDICTION_MARKET_ADDRESS = 'DEPLOY_CONTRACT_FIRST';
```

Замени на реальный адрес:
```ts
export const PREDICTION_MARKET_ADDRESS = 'tb1p...ваш_адрес_контракта...';
```

## 5. Создать начальные рынки

После деплоя вызови `createMarket(5)`, `createMarket(10)`, `createMarket(15)` с кошелька владельца,
чтобы создать первые рынки на 5/10/15 минут.

## Архитектура контракта

```
User → OPWallet.web3.signAndBroadcastInteraction({
  to: CONTRACT_ADDRESS,
  calldata: placeBet(marketId, direction, amount)
})
         ↓
OP_NET node → вызывает contract.execute(selector, calldata)
              → placeBet(marketId: u32, direction: u8, amount: u256)
              контракт хранит ставку, обновляет пул UP/DOWN
         ↓
Oracle/Owner → вызывает resolveMarket(marketId, endPrice)
              контракт определяет результат (UP/DOWN)
         ↓
User → вызывает claimWinnings(marketId)
              контракт рассчитывает пропорциональный выигрыш
              и эмитит событие WinningsClaimed с суммой payout
```

## API контракта

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `createMarket(uint8)` | duration (5/10/15) | Создать рынок (только owner) |
| `placeBet(uint32,uint8,uint256)` | marketId, direction (0=UP,1=DOWN), amount | Сделать ставку |
| `resolveMarket(uint32,uint64)` | marketId, endPrice (USD cents) | Закрыть рынок (только owner) |
| `claimWinnings(uint32)` | marketId | Забрать выигрыш |
| `getMarket(uint32)` | marketId | Получить данные рынка (view) |
| `getUserBet(uint32,address)` | marketId, user | Получить ставку пользователя (view) |
| `getActiveMarkets()` | — | Список активных рынков (view) |
