# Trading Module

## Overview
The Trading Module handles binary options trade placement, validation, and lifecycle management. It integrates with the Pricing Service for strike prices and the Wallet Module for stake locking.

## Key Features
- **Trade Placement**: REST API for opening new binary contracts.
- **Validation**: 10-step validation chain (account status, self-exclusion, market hours, limits, balance, latency).
- **Expiry Scheduling**: Enqueues expiry tasks to RabbitMQ.
- **Audit Trail**: Detailed event logging for every trade state change.

## Architecture
- **Controller**: `contractController.ts`, `assetController.ts`
- **Service**: `tradingService.ts`, `assetService.ts`
- **Repository**: `contractRepository.ts`, `contractEventRepository.ts`, `assetRepository.ts`, `assetConfigRepository.ts`
- **Validators**: `stakeValidator.ts`

## Configuration
- `MAX_STAKE_AMOUNT`
- `MIN_STAKE_AMOUNT`
- `MAX_ASSET_EXPOSURE`
- `LATENCY_THRESHOLD_MS`: Maximum allowed age for a strike price tick (default: 800ms).

## Security & Hardening
- **Latency Protection**: Rejects trades if the server's arrival time differs from the market price tick time by more than `LATENCY_THRESHOLD_MS`.
- **Atomic Exposure**: Exposure checks are performed inside a database transaction with a row-level lock on `asset_config` to prevent over-exposure bursts.
- **Oracle Gap Protection**: Trades are automatically cancelled and refunded if the settlement price tick is more than 10 seconds older than the expiry time.
- **Precision Math**: All financial fields are handled as strings and calculated using `Decimal.js` to eliminate floating-point rounding exploits.

## Events
- `TradeOpened`: Published when a trade is successfully placed and stake is locked.
- `TradeExpired`: Triggered by the expiry worker (Settlement Module).
