-- Migration 044: Add bid_price and ask_price to pricing.price_ticks
ALTER TABLE pricing.price_ticks ADD COLUMN IF NOT EXISTS bid_price NUMERIC(18,6);
ALTER TABLE pricing.price_ticks ADD COLUMN IF NOT EXISTS ask_price NUMERIC(18,6);

-- Backfill bid_price and ask_price from legacy bid/ask columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pricing' AND table_name='price_ticks' AND column_name='bid') THEN
    UPDATE pricing.price_ticks SET bid_price = bid WHERE bid_price IS NULL AND bid IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pricing' AND table_name='price_ticks' AND column_name='ask') THEN
    UPDATE pricing.price_ticks SET ask_price = ask WHERE ask_price IS NULL AND ask IS NOT NULL;
  END IF;
END $$;
