-- Migration 033: Isolate demo wallets, contracts, ticks, and reporting.
-- Apply only after the application version with explicit account/source routing
-- is ready; existing records are classified as real/live by the defaults.

BEGIN;

-- Wallets --------------------------------------------------------------------
ALTER TABLE wallet.wallets
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'real';

ALTER TABLE wallet.wallets
  DROP CONSTRAINT IF EXISTS wallet_wallets_account_type_check;
ALTER TABLE wallet.wallets
  ADD CONSTRAINT wallet_wallets_account_type_check
  CHECK (account_type IN ('real', 'demo'));

ALTER TABLE wallet.wallets
  DROP CONSTRAINT IF EXISTS wallet_wallets_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_wallets_user_account_type_uidx
  ON wallet.wallets(user_id, account_type);

-- Ledger reference types -----------------------------------------------------
-- Migration 003 and 026 use different constraint names. Remove both aliases
-- so they cannot independently reject valid legacy/demo reference values.
ALTER TABLE wallet.ledger_entries
  DROP CONSTRAINT IF EXISTS wallet_ledger_entries_reference_type_check;
ALTER TABLE wallet.ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_reference_type_check;
ALTER TABLE wallet.ledger_entries
  ADD CONSTRAINT ledger_entries_reference_type_check
  CHECK (reference_type IN (
    'deposit',
    'withdrawal',
    'trade_stake',
    'trade_payout',
    'referral_commission',
    'admin_adjustment',
    'trade_win',
    'trade_loss',
    'trade_draw',
    'fee',
    'referral_bonus',
    'platform_revenue',
    'demo_funding',
    'demo_reset',
    'demo_trade_stake',
    'demo_trade_payout'
  ));

CREATE OR REPLACE FUNCTION wallet.enforce_ledger_account_type()
RETURNS TRIGGER AS $$
DECLARE
  wallet_account_type VARCHAR(10);
  is_demo_reference BOOLEAN;
BEGIN
  SELECT account_type
    INTO wallet_account_type
    FROM wallet.wallets
   WHERE id = NEW.wallet_id
    FOR SHARE;

  IF wallet_account_type IS NULL THEN
    RAISE EXCEPTION 'Ledger wallet % does not exist', NEW.wallet_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  is_demo_reference := NEW.reference_type IN (
    'demo_funding', 'demo_reset', 'demo_trade_stake', 'demo_trade_payout'
  );

  IF (is_demo_reference AND wallet_account_type <> 'demo')
     OR (NOT is_demo_reference AND wallet_account_type <> 'real') THEN
    RAISE EXCEPTION 'Ledger reference % is not valid for % wallet',
      NEW.reference_type, wallet_account_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_ledger_account_type_guard_trg
  ON wallet.ledger_entries;
CREATE TRIGGER wallet_ledger_account_type_guard_trg
BEFORE INSERT OR UPDATE OF wallet_id, reference_type
ON wallet.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION wallet.enforce_ledger_account_type();

-- Durable idempotency and rate-limit events; successful reset writes this row
-- in the same transaction as its wallet and ledger updates.
CREATE TABLE IF NOT EXISTS wallet.demo_wallet_reset_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(255) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demo_wallet_reset_events_user_key_unique
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS demo_wallet_reset_events_user_created_idx
  ON wallet.demo_wallet_reset_events(user_id, created_at DESC);

-- Contracts ------------------------------------------------------------------
ALTER TABLE trading.binary_contracts
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'real';
ALTER TABLE trading.binary_contracts
  DROP CONSTRAINT IF EXISTS trading_binary_contracts_account_type_check;
ALTER TABLE trading.binary_contracts
  ADD CONSTRAINT trading_binary_contracts_account_type_check
  CHECK (account_type IN ('real', 'demo'));

CREATE INDEX IF NOT EXISTS trading_contracts_account_type_user_status_idx
  ON trading.binary_contracts(account_type, user_id, status, purchase_time DESC);
CREATE INDEX IF NOT EXISTS trading_contracts_exposure_mode_symbol_idx
  ON trading.binary_contracts(account_type, asset_symbol, status);

CREATE TABLE IF NOT EXISTS trading.demo_trade_idempotency (
  user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demo_trade_idempotency_user_key_unique
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS demo_trade_idempotency_created_idx
  ON trading.demo_trade_idempotency(created_at);

-- Ticks ----------------------------------------------------------------------
ALTER TABLE pricing.price_ticks
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'live';
ALTER TABLE pricing.price_ticks
  DROP CONSTRAINT IF EXISTS pricing_price_ticks_source_check;
ALTER TABLE pricing.price_ticks
  ADD CONSTRAINT pricing_price_ticks_source_check
  CHECK (source IN ('live', 'demo'));

CREATE INDEX IF NOT EXISTS pricing_price_ticks_symbol_source_time_idx
  ON pricing.price_ticks(symbol, source, tick_time DESC);
CREATE INDEX IF NOT EXISTS pricing_demo_ticks_retention_idx
  ON pricing.price_ticks(tick_time)
  WHERE source = 'demo';

-- Retention is limited to demo ticks older than 90 days. Never delete ledger
-- or audit events. A symbol with active/settling demo contracts is preserved.
CREATE OR REPLACE FUNCTION pricing.prune_expired_demo_ticks()
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM pricing.price_ticks tick
   WHERE tick.source = 'demo'
     AND tick.tick_time < NOW() - INTERVAL '90 days'
     AND NOT EXISTS (
       SELECT 1
         FROM trading.binary_contracts contract
        WHERE contract.account_type = 'demo'
          AND contract.status IN ('active', 'settling')
          AND contract.asset_symbol = tick.symbol
     );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Real-money reports ---------------------------------------------------------
-- Preserve the existing result shapes while excluding all demo contracts.
DROP MATERIALIZED VIEW IF EXISTS reporting.daily_trade_summary;
DROP MATERIALIZED VIEW IF EXISTS reporting.daily_revenue_summary;

DO $$
DECLARE
  stake_col TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'trading'
       AND table_name = 'binary_contracts'
       AND column_name = 'stake'
  ) THEN
    stake_col := 'stake';
  ELSE
    stake_col := 'stake_amount';
  END IF;

  EXECUTE format($view$
    CREATE MATERIALIZED VIEW reporting.daily_revenue_summary AS
    WITH daily_trades AS (
      SELECT DATE(created_at) AS report_date,
        SUM(%1$I) AS total_trade_volume,
        SUM(CASE
          WHEN status = 'won' THEN %1$I
          WHEN status = 'lost' THEN -potential_payout
          WHEN status = 'draw' THEN 0
          ELSE 0
        END) AS platform_revenue,
        COUNT(*) AS trade_count,
        COUNT(DISTINCT user_id) AS active_users
      FROM trading.binary_contracts
      WHERE account_type = 'real'
      GROUP BY DATE(created_at)
    ),
    daily_deposits AS (
      SELECT DATE(created_at) AS report_date,
        SUM(net_amount) FILTER (WHERE status = 'completed') AS total_deposits
      FROM payments.deposits
      GROUP BY DATE(created_at)
    ),
    daily_withdrawals AS (
      SELECT DATE(created_at) AS report_date,
        SUM(net_amount) FILTER (WHERE status = 'completed') AS total_withdrawals
      FROM payments.withdrawals
      GROUP BY DATE(created_at)
    ),
    daily_new_users AS (
      SELECT DATE(created_at) AS report_date, COUNT(*) AS new_users
      FROM app_auth.users
      GROUP BY DATE(created_at)
    )
    SELECT t.report_date,
      COALESCE(d.total_deposits, 0) AS total_deposits,
      COALESCE(w.total_withdrawals, 0) AS total_withdrawals,
      COALESCE(t.total_trade_volume, 0) AS total_trade_volume,
      COALESCE(t.platform_revenue, 0) AS platform_revenue,
      COALESCE(t.trade_count, 0) AS trade_count,
      COALESCE(t.active_users, 0) AS active_users,
      COALESCE(u.new_users, 0) AS new_users
    FROM daily_trades t
    LEFT JOIN daily_deposits d USING (report_date)
    LEFT JOIN daily_withdrawals w USING (report_date)
    LEFT JOIN daily_new_users u USING (report_date)
  $view$, stake_col);

  EXECUTE format($view$
    CREATE MATERIALIZED VIEW reporting.daily_trade_summary AS
    SELECT
      DATE(tr.created_at) AS report_date,
      tr.asset_symbol,
      COUNT(*) AS total_trades,
      SUM(CASE WHEN tr.status = 'won' THEN 1 ELSE 0 END) AS win_count,
      SUM(CASE WHEN tr.status = 'lost' THEN 1 ELSE 0 END) AS loss_count,
      SUM(CASE WHEN tr.status = 'draw' THEN 1 ELSE 0 END) AS draw_count,
      SUM(tr.%1$I) AS total_stake,
      SUM(CASE WHEN tr.status = 'won' THEN tr.potential_payout ELSE 0 END) AS total_payout,
      COALESCE(SUM(CASE
        WHEN tr.status = 'won' THEN tr.%1$I
        WHEN tr.status = 'lost' THEN -tr.potential_payout
        WHEN tr.status = 'draw' THEN 0
        ELSE 0
      END), 0) AS net_revenue
    FROM trading.binary_contracts tr
    WHERE tr.account_type = 'real'
    GROUP BY DATE(tr.created_at), tr.asset_symbol
  $view$, stake_col);
END $$;

CREATE UNIQUE INDEX daily_revenue_summary_date_idx
  ON reporting.daily_revenue_summary(report_date);
CREATE UNIQUE INDEX daily_trade_summary_date_asset_idx
  ON reporting.daily_trade_summary(report_date, asset_symbol);

CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.daily_revenue_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.daily_trade_summary;
END;
$$ LANGUAGE plpgsql;

COMMIT;
