-- Migration 030: Fix pricing.price_ticks column names
-- This migration aligns the price_ticks table with the repository expectations
-- Renames old columns (bid, ask, price) to new names (bid_price, ask_price, mid_price)
-- This migration is idempotent - it checks if columns exist before renaming

DO $$
BEGIN
    -- 1. Rename bid to bid_price if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'pricing' AND table_name = 'price_ticks' AND column_name = 'bid'
    ) THEN
        ALTER TABLE pricing.price_ticks RENAME COLUMN bid TO bid_price;
    END IF;

    -- 2. Rename ask to ask_price if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'pricing' AND table_name = 'price_ticks' AND column_name = 'ask'
    ) THEN
        ALTER TABLE pricing.price_ticks RENAME COLUMN ask TO ask_price;
    END IF;

    -- 3. Rename price to mid_price if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'pricing' AND table_name = 'price_ticks' AND column_name = 'price'
    ) THEN
        ALTER TABLE pricing.price_ticks RENAME COLUMN price TO mid_price;
    END IF;
END $$;

-- 4. Update CHECK constraints to match new column names (idempotent)
DO $$
BEGIN
    -- Drop old constraints if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_bid_check') THEN
        ALTER TABLE pricing.price_ticks DROP CONSTRAINT price_ticks_bid_check;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_ask_check') THEN
        ALTER TABLE pricing.price_ticks DROP CONSTRAINT price_ticks_ask_check;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_price_check') THEN
        ALTER TABLE pricing.price_ticks DROP CONSTRAINT price_ticks_price_check;
    END IF;
    
    -- Add new constraints if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_bid_price_check') THEN
        ALTER TABLE pricing.price_ticks ADD CONSTRAINT price_ticks_bid_price_check CHECK (bid_price > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_ask_price_check') THEN
        ALTER TABLE pricing.price_ticks ADD CONSTRAINT price_ticks_ask_price_check CHECK (ask_price > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_ticks_mid_price_check') THEN
        ALTER TABLE pricing.price_ticks ADD CONSTRAINT price_ticks_mid_price_check CHECK (mid_price > 0);
    END IF;
END $$;
