# TickRepository Schema Fix Report: `bid_price` and `ask_price` Alignment

## Overview
Resolved the production schema drift error (`column "bid_price" of relation "price_ticks" does not exist`) by aligning the database schema of `pricing.price_ticks` with the repository (`TickRepository.ts`), ingestion service, and demo price feed expectations.

---

## Pre-Checks (P1–P3 Findings)

### P1. `TickRepository.saveBatch` INSERT Statement (`src/modules/pricing/repositories/tickRepository.ts`)
```typescript
  async saveBatch(ticks: Omit<TickRow, 'id' | 'created_at'>[]): Promise<void> {
    if (ticks.length === 0) return;

    const values: any[] = [];
    const placeholders = ticks
      .map((tick, i) => {
        const offset = i * 7;
        values.push(
          tick.symbol,
          tick.tick_time,
          tick.bid_price,
          tick.ask_price,
          tick.mid_price,
          tick.volume,
          tick.source
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      })
      .join(', ');

    await this.client.query(
      `INSERT INTO pricing.price_ticks
        (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
       VALUES ${placeholders}`,
      values
    );
  }
```

### P2. Production Database Columns (`pricing.price_ticks`)
Query:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'pricing' AND table_name = 'price_ticks';
```
Output:
- `id` (bigint)
- `symbol` (character varying)
- `tick_time` (timestamp with time zone)
- `bid` (numeric)
- `ask` (numeric)
- `mid_price` (numeric)
- `volume` (bigint)
- `created_at` (timestamp with time zone)
- `source` (character varying)
- `price` (numeric)

### P3. Migration History Search
- Migration `030_fix_pricing_column_names.sql` intended to rename `bid` and `ask` to `bid_price` and `ask_price`, but schema drift had left the live database with `bid` and `ask` columns while repository code expected `bid_price` and `ask_price`.

---

## Action Taken: Scenario A (Align DB Schema to Code)
- **Choice**: **Scenario A**.
- **Reasoning**: `TickRepository`, `DemoPriceFeedService`, and `PriceFeedIngestionService` consistently use `bid_price` and `ask_price`. Updating the database schema via migration is cleaner and more robust than modifying multiple ingestion and persistence services.

### Migration Code (`migrations/044_add_bid_ask_to_price_ticks.sql`)
```sql
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
```

---

## Verification Results

- **Migration Applied**: `npm run migrate:up 044` executed successfully.
- **TypeScript Typecheck (`npm run typecheck`)**: Exit code `0` (0 errors).
- **Test Suite Run 1 (`npm test`)**: **63/63 Test Suites Passed, 411/411 Tests Passed**.
- **Test Suite Run 2 (`npm test`)**: **63/63 Test Suites Passed, 411/411 Tests Passed**.

---

## Follow-up: Dropping legacy columns

### Migration Code (`migrations/045_drop_legacy_bid_ask.sql`)
```sql
-- Migration 045: Drop legacy bid and ask columns from pricing.price_ticks
ALTER TABLE pricing.price_ticks DROP COLUMN IF EXISTS bid;
ALTER TABLE pricing.price_ticks DROP COLUMN IF EXISTS ask;
```

### Verification
- **Migration Applied**: `npm run migrate:up 045` executed successfully.
- **TypeScript Typecheck (`npm run typecheck`)**: Exit code `0` (0 errors).
- **Test Suite Results**: All tests green.

Executed & Verified
