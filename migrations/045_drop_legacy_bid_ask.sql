-- Migration 045: Drop legacy bid and ask columns from pricing.price_ticks
ALTER TABLE pricing.price_ticks DROP COLUMN IF EXISTS bid;
ALTER TABLE pricing.price_ticks DROP COLUMN IF EXISTS ask;
