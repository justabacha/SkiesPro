-- Migration 048: Drop redundant pricing indexes to prevent disk bloat
-- These redundant indexes are subsumed by pricing_price_ticks_symbol_source_time_idx and pricing_candles_unique

DROP INDEX IF EXISTS pricing.price_ticks_symbol_idx;
DROP INDEX IF EXISTS pricing.price_ticks_settlement_idx;
DROP INDEX IF EXISTS pricing.price_ticks_time_idx;
DROP INDEX IF EXISTS pricing.candles_symbol_granularity_time_idx;
