/**
 * PredictionMarket.ts — AssemblyScript OP_NET Smart Contract
 *
 * Prediction market where users bet BTC UP/DOWN on 5/10/15 minute markets.
 *
 * Flow:
 *  1. Admin calls createMarket(duration) → market is created
 *  2. Users call placeBet(marketId, direction, amount) to place a bet
 *  3. At market end, oracle calls resolveMarket(marketId, endPrice)
 *  4. Winners call claimWinnings(marketId) to receive proportional payout (emitted as event)
 */

import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Blockchain,
    OP_NET,
    Selector,
    Calldata,
    BytesWriter,
    Address,
    SafeMath,
    StoredU32,
    StoredU64,
    StoredU256,
    StoredAddress,
    encodeSelector,
    NetEvent,
    ADDRESS_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    EMPTY_POINTER,
    Revert,
} from '@btc-vision/btc-runtime/runtime';

// ─── Storage pointer constants ─────────────────────────────────────────────
const POINTER_OWNER: u16 = 1;
const POINTER_MKT_COUNT: u16 = 2;
const POINTER_MKT_DUR: u16 = 10;      // market duration (stored as u32 index 0)
const POINTER_MKT_STATUS: u16 = 11;   // 0=open, 1=locked, 2=resolved (u32 index 0)
const POINTER_MKT_RESULT: u16 = 12;   // 0=UP, 1=DOWN, 255=pending (u32 index 0)
const POINTER_MKT_TIMES: u16 = 13;    // StoredU64: [startTime, endTime, lockTime, startPrice]
const POINTER_MKT_EPRICE: u16 = 14;   // end price (u64 index 0)
const POINTER_MKT_TUP: u16 = 17;      // total UP pool (u256)
const POINTER_MKT_TDOWN: u16 = 18;    // total DOWN pool (u256)
const POINTER_BET_AMT: u16 = 20;      // bet amount per user (u256)
const POINTER_BET_DIR: u16 = 21;      // bet direction per user (u32 index 0)
const POINTER_BET_CLAIMED: u16 = 22;  // bet claimed per user (u32 index 0, 0=false, 1=true)
const POINTER_BET_EXISTS: u16 = 23;   // whether bet exists (u32 index 0, 0=no, 1=yes)

// ─── Result constants ──────────────────────────────────────────────────────
const DIRECTION_UP: u8 = 0;
const DIRECTION_DOWN: u8 = 1;
const RESULT_UP: u8 = 0;
const RESULT_DOWN: u8 = 1;
const RESULT_PENDING: u8 = 255;

const STATUS_OPEN: u8 = 0;
const STATUS_RESOLVED: u8 = 2;

// Lock bets 30 seconds before market end
const LOCK_OFFSET_SEC: u64 = 30;

// ─── Helper: encode a u32 marketId as a 30-byte subPointer ────────────────
function marketSubPointer(marketId: u32): Uint8Array {
    const buf = new Uint8Array(30);
    buf[0] = u8(marketId & 0xFF);
    buf[1] = u8((marketId >> 8) & 0xFF);
    buf[2] = u8((marketId >> 16) & 0xFF);
    buf[3] = u8((marketId >> 24) & 0xFF);
    return buf;
}

// ─── Helper: encode marketId + address as a 30-byte subPointer ────────────
function betSubPointer(marketId: u32, user: Address): Uint8Array {
    const buf = new Uint8Array(30);
    buf[0] = u8(marketId & 0xFF);
    buf[1] = u8((marketId >> 8) & 0xFF);
    buf[2] = u8((marketId >> 16) & 0xFF);
    buf[3] = u8((marketId >> 24) & 0xFF);
    for (let i: i32 = 0; i < 26; i++) {
        buf[4 + i] = user[i];
    }
    return buf;
}

// ─── Custom Events ────────────────────────────────────────────────────────
@final
class MarketCreatedEvent extends NetEvent {
    constructor(marketId: u32, duration: u8, startTime: u64, endTime: u64) {
        const data = new BytesWriter(4 + 1 + 8 + 8);
        data.writeU32(marketId);
        data.writeU8(duration);
        data.writeU64(startTime);
        data.writeU64(endTime);
        super('MarketCreated', data);
    }
}

@final
class BetPlacedEvent extends NetEvent {
    constructor(marketId: u32, sender: Address, direction: u8, amount: u256) {
        const data = new BytesWriter(4 + ADDRESS_BYTE_LENGTH + 1 + U256_BYTE_LENGTH);
        data.writeU32(marketId);
        data.writeAddress(sender);
        data.writeU8(direction);
        data.writeU256(amount);
        super('BetPlaced', data);
    }
}

@final
class MarketResolvedEvent extends NetEvent {
    constructor(marketId: u32, endPrice: u64, result: u8) {
        const data = new BytesWriter(4 + 8 + 1);
        data.writeU32(marketId);
        data.writeU64(endPrice);
        data.writeU8(result);
        super('MarketResolved', data);
    }
}

@final
class WinningsClaimedEvent extends NetEvent {
    constructor(marketId: u32, sender: Address, payout: u256) {
        const data = new BytesWriter(4 + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH);
        data.writeU32(marketId);
        data.writeAddress(sender);
        data.writeU256(payout);
        super('WinningsClaimed', data);
    }
}

// ─── Contract ─────────────────────────────────────────────────────────────
@contract
export class PredictionMarket extends OP_NET {

    private readonly _owner: StoredAddress;
    private readonly _marketCountStorage: StoredU32;

    public constructor() {
        super();
        this._owner = new StoredAddress(POINTER_OWNER);
        this._marketCountStorage = new StoredU32(POINTER_MKT_COUNT, EMPTY_POINTER);
    }

    // ─── Selectors ─────────────────────────────────────────────────────────
    private readonly createMarketSelector: Selector = encodeSelector('createMarket(uint8)');
    private readonly placeBetSelector: Selector = encodeSelector('placeBet(uint32,uint8,uint256)');
    private readonly resolveMarketSelector: Selector = encodeSelector('resolveMarket(uint32,uint64)');
    private readonly claimWinningsSelector: Selector = encodeSelector('claimWinnings(uint32)');
    private readonly getMarketSelector: Selector = encodeSelector('getMarket(uint32)');
    private readonly getUserBetSelector: Selector = encodeSelector('getUserBet(uint32,address)');
    private readonly getActiveMarketsSelector: Selector = encodeSelector('getActiveMarkets()');

    // ─── Method dispatch ───────────────────────────────────────────────────
    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case this.createMarketSelector:
                return this._createMarket(calldata);
            case this.placeBetSelector:
                return this._placeBet(calldata);
            case this.resolveMarketSelector:
                return this._resolveMarket(calldata);
            case this.claimWinningsSelector:
                return this._claimWinnings(calldata);
            case this.getMarketSelector:
                return this._getMarket(calldata);
            case this.getUserBetSelector:
                return this._getUserBet(calldata);
            case this.getActiveMarketsSelector:
                return this._getActiveMarkets();
            default:
                return super.execute(method, calldata);
        }
    }

    // ─── Storage helpers ───────────────────────────────────────────────────

    private mktU32(ptr: u16, marketId: u32): StoredU32 {
        return new StoredU32(ptr, marketSubPointer(marketId));
    }

    private mktU64(ptr: u16, marketId: u32): StoredU64 {
        return new StoredU64(ptr, marketSubPointer(marketId));
    }

    private mktU256(ptr: u16, marketId: u32): StoredU256 {
        return new StoredU256(ptr, marketSubPointer(marketId));
    }

    private betU32(ptr: u16, marketId: u32, user: Address): StoredU32 {
        return new StoredU32(ptr, betSubPointer(marketId, user));
    }

    private betU256(ptr: u16, marketId: u32, user: Address): StoredU256 {
        return new StoredU256(ptr, betSubPointer(marketId, user));
    }

    // ─── Getters for market count ──────────────────────────────────────────
    private getMarketCount(): u32 {
        return this._marketCountStorage.get(0);
    }

    private setMarketCount(count: u32): void {
        this._marketCountStorage.set(0, count);
        this._marketCountStorage.save();
    }

    // ─── Initializer (called on first deploy) ─────────────────────────────
    public override onDeployment(calldata: Calldata): void {
        this._owner.value = Blockchain.tx.sender;
        this.setMarketCount(0);
    }

    // ─── createMarket(duration: u8) -> u32 ────────────────────────────────
    private _createMarket(calldata: Calldata): BytesWriter {
        this._requireOwner();

        const duration: u8 = calldata.readU8();
        if (duration !== 5 && duration !== 10 && duration !== 15) {
            throw new Revert('Invalid duration: must be 5, 10, or 15');
        }

        const marketId: u32 = this.getMarketCount() + 1;
        this.setMarketCount(marketId);

        const nowSec: u64 = Blockchain.block.medianTimestamp;
        const durationSec: u64 = u64(duration) * 60;

        // Store duration
        const durStorage = this.mktU32(POINTER_MKT_DUR, marketId);
        durStorage.set(0, u32(duration));
        durStorage.save();

        // Store status = OPEN
        const statusStorage = this.mktU32(POINTER_MKT_STATUS, marketId);
        statusStorage.set(0, u32(STATUS_OPEN));
        statusStorage.save();

        // Store result = PENDING
        const resultStorage = this.mktU32(POINTER_MKT_RESULT, marketId);
        resultStorage.set(0, u32(RESULT_PENDING));
        resultStorage.save();

        // Store times: [startTime, endTime, lockTime, startPrice=0]
        const timesStorage = this.mktU64(POINTER_MKT_TIMES, marketId);
        timesStorage.set(0, nowSec);
        timesStorage.set(1, nowSec + durationSec);
        timesStorage.set(2, nowSec + durationSec - LOCK_OFFSET_SEC);
        timesStorage.set(3, 0);
        timesStorage.save();

        // Store end price = 0
        const ePriceStorage = this.mktU64(POINTER_MKT_EPRICE, marketId);
        ePriceStorage.set(0, 0);
        ePriceStorage.save();

        // Initialize pools to zero
        this.mktU256(POINTER_MKT_TUP, marketId).value = u256.Zero;
        this.mktU256(POINTER_MKT_TDOWN, marketId).value = u256.Zero;

        // Emit MarketCreated event
        this.emitEvent(new MarketCreatedEvent(marketId, duration, nowSec, nowSec + durationSec));

        const resp = new BytesWriter(4);
        resp.writeU32(marketId);
        return resp;
    }

    // ─── placeBet(marketId: u32, direction: u8, amount: u256) ─────────────
    private _placeBet(calldata: Calldata): BytesWriter {
        const marketId: u32 = calldata.readU32();
        const direction: u8 = calldata.readU8();
        const betAmount: u256 = calldata.readU256();

        if (direction !== DIRECTION_UP && direction !== DIRECTION_DOWN) {
            throw new Revert('Invalid direction: 0=UP, 1=DOWN');
        }

        const statusStorage = this.mktU32(POINTER_MKT_STATUS, marketId);
        const status: u8 = u8(statusStorage.get(0));
        if (status !== STATUS_OPEN) {
            throw new Revert('Market is not open for betting');
        }

        const nowSec: u64 = Blockchain.block.medianTimestamp;
        const timesStorage = this.mktU64(POINTER_MKT_TIMES, marketId);
        const lockTime: u64 = timesStorage.get(2);
        if (nowSec >= lockTime) {
            throw new Revert('Betting is locked for this market');
        }

        if (betAmount == u256.Zero) {
            throw new Revert('Bet amount must be greater than zero');
        }

        const sender: Address = Blockchain.tx.sender;

        // Prevent double betting
        const existsStorage = this.betU32(POINTER_BET_EXISTS, marketId, sender);
        if (existsStorage.get(0) == 1) {
            throw new Revert('Already placed a bet in this market');
        }

        // Record bet
        this.betU256(POINTER_BET_AMT, marketId, sender).value = betAmount;

        const dirStorage = this.betU32(POINTER_BET_DIR, marketId, sender);
        dirStorage.set(0, u32(direction));
        dirStorage.save();

        const claimedStorage = this.betU32(POINTER_BET_CLAIMED, marketId, sender);
        claimedStorage.set(0, 0);
        claimedStorage.save();

        existsStorage.set(0, 1);
        existsStorage.save();

        // Update pool totals
        if (direction === DIRECTION_UP) {
            const prev: u256 = this.mktU256(POINTER_MKT_TUP, marketId).value;
            this.mktU256(POINTER_MKT_TUP, marketId).value = SafeMath.add(prev, betAmount);
        } else {
            const prev: u256 = this.mktU256(POINTER_MKT_TDOWN, marketId).value;
            this.mktU256(POINTER_MKT_TDOWN, marketId).value = SafeMath.add(prev, betAmount);
        }

        // Emit BetPlaced event
        this.emitEvent(new BetPlacedEvent(marketId, sender, direction, betAmount));

        return new BytesWriter(0);
    }

    // ─── resolveMarket(marketId: u32, endPrice: u64) ──────────────────────
    private _resolveMarket(calldata: Calldata): BytesWriter {
        this._requireOwner();

        const marketId: u32 = calldata.readU32();
        const endPrice: u64 = calldata.readU64();

        const statusStorage = this.mktU32(POINTER_MKT_STATUS, marketId);
        const status: u8 = u8(statusStorage.get(0));
        if (status === STATUS_RESOLVED) {
            throw new Revert('Market already resolved');
        }

        const timesStorage = this.mktU64(POINTER_MKT_TIMES, marketId);
        const startPrice: u64 = timesStorage.get(3);

        // Determine result
        const result: u8 = endPrice >= startPrice ? RESULT_UP : RESULT_DOWN;

        statusStorage.set(0, u32(STATUS_RESOLVED));
        statusStorage.save();

        const ePriceStorage = this.mktU64(POINTER_MKT_EPRICE, marketId);
        ePriceStorage.set(0, endPrice);
        ePriceStorage.save();

        const resultStorage = this.mktU32(POINTER_MKT_RESULT, marketId);
        resultStorage.set(0, u32(result));
        resultStorage.save();

        // Emit MarketResolved event
        this.emitEvent(new MarketResolvedEvent(marketId, endPrice, result));

        return new BytesWriter(0);
    }

    // ─── claimWinnings(marketId: u32) → payout: u256 ──────────────────────
    private _claimWinnings(calldata: Calldata): BytesWriter {
        const marketId: u32 = calldata.readU32();
        const sender: Address = Blockchain.tx.sender;

        const statusStorage = this.mktU32(POINTER_MKT_STATUS, marketId);
        const status: u8 = u8(statusStorage.get(0));
        if (status !== STATUS_RESOLVED) {
            throw new Revert('Market not yet resolved');
        }

        const claimedStorage = this.betU32(POINTER_BET_CLAIMED, marketId, sender);
        if (claimedStorage.get(0) == 1) {
            throw new Revert('Winnings already claimed');
        }

        const existsStorage = this.betU32(POINTER_BET_EXISTS, marketId, sender);
        if (existsStorage.get(0) == 0) {
            throw new Revert('No bet found for this address');
        }

        const betAmount: u256 = this.betU256(POINTER_BET_AMT, marketId, sender).value;
        const dirStorage = this.betU32(POINTER_BET_DIR, marketId, sender);
        const direction: u8 = u8(dirStorage.get(0));

        const resultStorage = this.mktU32(POINTER_MKT_RESULT, marketId);
        const result: u8 = u8(resultStorage.get(0));

        const totalUp: u256 = this.mktU256(POINTER_MKT_TUP, marketId).value;
        const totalDown: u256 = this.mktU256(POINTER_MKT_TDOWN, marketId).value;
        const totalPool: u256 = SafeMath.add(totalUp, totalDown);

        let payout: u256 = u256.Zero;
        const won: bool =
            (direction === DIRECTION_UP && result === RESULT_UP) ||
            (direction === DIRECTION_DOWN && result === RESULT_DOWN);

        if (won) {
            const winnerPool: u256 = result === RESULT_UP ? totalUp : totalDown;
            if (winnerPool > u256.Zero) {
                const numerator: u256 = SafeMath.mul(betAmount, totalPool);
                payout = SafeMath.div(numerator, winnerPool);
            }
        }

        // Mark as claimed
        claimedStorage.set(0, 1);
        claimedStorage.save();

        if (payout > u256.Zero) {
            this.emitEvent(new WinningsClaimedEvent(marketId, sender, payout));
        }

        const resp = new BytesWriter(U256_BYTE_LENGTH);
        resp.writeU256(payout);
        return resp;
    }

    // ─── getMarket(marketId: u32) ──────────────────────────────────────────
    private _getMarket(calldata: Calldata): BytesWriter {
        const marketId: u32 = calldata.readU32();

        const durStorage = this.mktU32(POINTER_MKT_DUR, marketId);
        const duration: u32 = durStorage.get(0);

        const timesStorage = this.mktU64(POINTER_MKT_TIMES, marketId);
        const startTime: u64 = timesStorage.get(0);
        const endTime: u64 = timesStorage.get(1);
        const startPrice: u64 = timesStorage.get(3);

        const ePriceStorage = this.mktU64(POINTER_MKT_EPRICE, marketId);
        const endPrice: u64 = ePriceStorage.get(0);

        const statusStorage = this.mktU32(POINTER_MKT_STATUS, marketId);
        const status: u32 = statusStorage.get(0);

        const totalUp: u256 = this.mktU256(POINTER_MKT_TUP, marketId).value;
        const totalDown: u256 = this.mktU256(POINTER_MKT_TDOWN, marketId).value;

        const resultStorage = this.mktU32(POINTER_MKT_RESULT, marketId);
        const result: u32 = resultStorage.get(0);

        const resp = new BytesWriter(4 + 1 + 8 + 8 + 8 + 8 + 1 + U256_BYTE_LENGTH + U256_BYTE_LENGTH + 1);
        resp.writeU32(marketId);
        resp.writeU8(u8(duration));
        resp.writeU64(startTime);
        resp.writeU64(endTime);
        resp.writeU64(startPrice);
        resp.writeU64(endPrice);
        resp.writeU8(u8(status));
        resp.writeU256(totalUp);
        resp.writeU256(totalDown);
        resp.writeU8(u8(result));
        return resp;
    }

    // ─── getUserBet(marketId: u32, user: Address) ──────────────────────────
    private _getUserBet(calldata: Calldata): BytesWriter {
        const marketId: u32 = calldata.readU32();
        const user: Address = calldata.readAddress();

        const betAmount: u256 = this.betU256(POINTER_BET_AMT, marketId, user).value;
        const dirStorage = this.betU32(POINTER_BET_DIR, marketId, user);
        const direction: u8 = u8(dirStorage.get(0));
        const claimedStorage = this.betU32(POINTER_BET_CLAIMED, marketId, user);
        const claimed: bool = claimedStorage.get(0) == 1;

        const resp = new BytesWriter(U256_BYTE_LENGTH + 1 + 1);
        resp.writeU256(betAmount);
        resp.writeU8(direction);
        resp.writeBoolean(claimed);
        return resp;
    }

    // ─── getActiveMarkets() ────────────────────────────────────────────────
    private _getActiveMarkets(): BytesWriter {
        const count: u32 = this.getMarketCount();
        const active: u32[] = [];

        for (let id: u32 = 1; id <= count; id++) {
            const statusStorage = this.mktU32(POINTER_MKT_STATUS, id);
            const status: u32 = statusStorage.get(0);
            if (status !== u32(STATUS_RESOLVED)) {
                active.push(id);
            }
        }

        const resp = new BytesWriter(4 + active.length * 4);
        resp.writeU32(u32(active.length));
        for (let i: i32 = 0; i < active.length; i++) {
            resp.writeU32(active[i]);
        }
        return resp;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────
    private _requireOwner(): void {
        if (Blockchain.tx.sender !== this._owner.value) {
            throw new Revert('Only contract owner can call this method');
        }
    }
}
