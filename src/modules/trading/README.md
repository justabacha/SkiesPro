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
- `LATENCY_THRESHOLD_MS`

## Events
- `TradeOpened`: Published when a trade is successfully placed and stake is locked.
- `TradeExpired`: Triggered by the expiry worker (Settlement Module).
