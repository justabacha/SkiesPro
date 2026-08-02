-- Migration 005: Pricing schema tables
-- Creates tables for price data as per DDS §5.16-5.18

-- pricing.price_ticks
CREATE TABLE IF NOT EXISTS pricing.price_ticks (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  tick_time TIMESTAMPTZ NOT NULL,
  bid_price NUMERIC(12,6) NOT NULL CHECK (bid_price > 0),
  ask_price NUMERIC(12,6) NOT NULL CHECK (ask_price > 0),
  mid_price NUMERIC(12,6) NOT NULL CHECK (mid_price > 0),
  volume BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_price_ticks_symbol_fkey FOREIGN KEY (symbol) REFERENCES trading.assets(symbol)
);

-- pricing.candles
CREATE TABLE IF NOT EXISTS pricing.candles (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  granularity_seconds INTEGER NOT NULL CHECK (granularity_seconds > 0),
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL,
  open_price NUMERIC(12,6) NOT NULL CHECK (open_price > 0),
  high_price NUMERIC(12,6) NOT NULL CHECK (high_price > 0),
  low_price NUMERIC(12,6) NOT NULL CHECK (low_price > 0),
  close_price NUMERIC(12,6) NOT NULL CHECK (close_price > 0),
  volume BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_candles_symbol_fkey FOREIGN KEY (symbol) REFERENCES trading.assets(symbol),
  CONSTRAINT pricing_candles_unique UNIQUE (symbol, granularity_seconds, open_time)
);

-- pricing.market_hours
CREATE TABLE IF NOT EXISTS pricing.market_hours (
  asset_symbol VARCHAR(20) PRIMARY KEY,
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  is_24_7 BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT pricing_market_hours_asset_symbol_fkey FOREIGN KEY (asset_symbol) REFERENCES trading.assets(symbol)
);

-- Indexes for pricing schema
CREATE INDEX IF NOT EXISTS price_ticks_symbol_idx ON pricing.price_ticks(symbol);
CREATE INDEX IF NOT EXISTS price_ticks_settlement_idx ON pricing.price_ticks(symbol, tick_time DESC);
CREATE INDEX IF NOT EXISTS candles_symbol_granularity_time_idx ON pricing.candles(symbol, granularity_seconds, open_time);
