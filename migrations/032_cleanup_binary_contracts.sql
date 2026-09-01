-- Migration 032: Cleanup redundant columns and rogue constraints in binary_contracts
-- Removes entry_price as it is redundant with strike_price as per WP-10 §4.2
-- Drops rogue constraints that survived column renames

DO $$
BEGIN
    -- Drop redundant column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='entry_price') THEN
        ALTER TABLE trading.binary_contracts DROP COLUMN entry_price;
    END IF;

    -- Drop rogue constraints on contract_type
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_direction_check;
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_direction_check;

    -- Drop rogue constraints on payout_rate
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_payout_ratio_check;
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_ratio_check;

    -- Drop rogue constraints on status
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_status_check;
    -- Note: trading_binary_contracts_status_check is the new correct one

    -- Drop rogue constraints on stake
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_stake_amount_check;

    -- Drop rogue constraints on strike_price
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_strike_price_check;

    -- Drop rogue constraints on potential_payout
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS binary_contracts_potential_payout_check;

END $$;
