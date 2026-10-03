# Trading Module

## Overview
The Trading Module handles binary options trade placement, validation, and lifecycle management. It integrates with the Pricing Service for strike prices and the Wallet Module for stake locking.

## Key Features
- **Trade Placement**: REST API for opening new binary contracts.
- **Validation**: account status, self-exclusion, market hours, limits, balance, current quote, and slippage.
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
- In-process price ticks expire after 10 seconds; no Redis connection or environment variable is required.

## Security & Hardening
- **Quote Protection**: Rejects trades without a cached tick no older than 10 seconds and rejects client quotes more than five symbol-specific pips from the server mid.
- **Atomic Exposure**: Exposure checks are performed inside a database transaction with a row-level lock on `asset_config` to prevent over-exposure bursts.
- **Oracle Gap Protection**: Trades are automatically cancelled and refunded if the settlement price tick is more than 10 seconds older than the expiry time.
- **Precision Math**: All financial fields are handled as strings and calculated using `Decimal.js` to eliminate floating-point rounding exploits.

## Events
- `TradeOpened`: Published when a trade is successfully placed and stake is locked.
- `TradeExpired`: Triggered by the expiry worker (Settlement Module).
