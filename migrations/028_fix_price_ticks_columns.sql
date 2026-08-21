-- Migration 028: Fix pricing.price_ticks columns
-- This migration aligns the price_ticks table with the repository expectations
-- It handles the redundant 'mid_price' and 'price' columns

-- 1. Drop the nullable 'price' column added in migration 019
ALTER TABLE pricing.price_ticks DROP COLUMN IF EXISTS price;

-- 2. Rename 'mid_price' (from migration 005) to 'price'
-- This column is already NOT NULL and has a CHECK constraint (mid_price > 0)
ALTER TABLE pricing.price_ticks RENAME COLUMN mid_price TO price;

-- 3. Update the CHECK constraint name to match the new column name
ALTER TABLE pricing.price_ticks DROP CONSTRAINT IF EXISTS price_ticks_mid_price_check;
ALTER TABLE pricing.price_ticks ADD CONSTRAINT price_ticks_price_check CHECK (price > 0);

-- 4. Update the RETURNING clause and other queries in the repository if necessary
-- (The repository already uses 'price', so this migration makes it work)
