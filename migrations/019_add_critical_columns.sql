-- Migration 019: Add critical missing columns
-- Adds columns required for core functionality as per WP_02_INTEGRITY_REVIEW.md
-- This migration addresses CRITICAL and HIGH impact issues only

-- ============================================================================
-- app_auth.users critical columns
-- ============================================================================
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed'));
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS mfa_type VARCHAR(20) CHECK (mfa_type IN ('totp','sms') OR NULL);
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES app_auth.users(id) ON DELETE SET NULL;
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0);
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- app_auth.sessions critical columns
-- ============================================================================
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS access_token_jti VARCHAR(64) UNIQUE;
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255);
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- ============================================================================
-- app_auth.mfa_tokens critical columns
-- ============================================================================
ALTER TABLE app_auth.mfa_tokens ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE app_auth.mfa_tokens ADD COLUMN IF NOT EXISTS enabled_at TIMESTAMPTZ;
ALTER TABLE app_auth.mfa_tokens ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- ============================================================================
-- app_auth.permissions critical columns
-- ============================================================================
ALTER TABLE app_auth.permissions ADD COLUMN IF NOT EXISTS resource VARCHAR(50);
ALTER TABLE app_auth.permissions ADD COLUMN IF NOT EXISTS action VARCHAR(50);

-- ============================================================================
-- app_auth.user_roles critical columns
-- ============================================================================
ALTER TABLE app_auth.user_roles ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES app_auth.users(id) ON DELETE SET NULL;
ALTER TABLE app_auth.user_roles ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- ============================================================================
-- wallet.wallets critical columns
-- ============================================================================
ALTER TABLE wallet.wallets ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','closed'));
ALTER TABLE wallet.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- wallet.ledger_entries critical columns
-- ============================================================================
ALTER TABLE wallet.ledger_entries ADD COLUMN IF NOT EXISTS balance_before NUMERIC(16,4);

-- ============================================================================
-- wallet.wallet_version_log critical columns
-- ============================================================================
ALTER TABLE wallet.wallet_version_log ADD COLUMN IF NOT EXISTS version_before INTEGER;
ALTER TABLE wallet.wallet_version_log ADD COLUMN IF NOT EXISTS version_after INTEGER;
ALTER TABLE wallet.wallet_version_log ADD COLUMN IF NOT EXISTS changed_by VARCHAR(50);

-- ============================================================================
-- trading.binary_contracts critical columns
-- ============================================================================
ALTER TABLE trading.binary_contracts ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE trading.binary_contracts ADD COLUMN IF NOT EXISTS lock_tx_id UUID REFERENCES wallet.ledger_entries(id);
ALTER TABLE trading.binary_contracts ADD COLUMN IF NOT EXISTS payout_tx_id UUID REFERENCES wallet.ledger_entries(id);
ALTER TABLE trading.binary_contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- trading.assets critical columns
-- ============================================================================
ALTER TABLE trading.assets ADD COLUMN IF NOT EXISTS min_stake NUMERIC(16,4) NOT NULL DEFAULT 1.00;
ALTER TABLE trading.assets ADD COLUMN IF NOT EXISTS max_stake NUMERIC(16,4) NOT NULL DEFAULT 500.00;
ALTER TABLE trading.assets ADD COLUMN IF NOT EXISTS min_expiry_seconds INTEGER NOT NULL DEFAULT 60;
ALTER TABLE trading.assets ADD COLUMN IF NOT EXISTS max_expiry_seconds INTEGER NOT NULL DEFAULT 86400;
ALTER TABLE trading.assets ADD COLUMN IF NOT EXISTS pip_decimal_places SMALLINT NOT NULL DEFAULT 5;

-- ============================================================================
-- trading.asset_config critical columns
-- ============================================================================
ALTER TABLE trading.asset_config ADD COLUMN IF NOT EXISTS max_exposure NUMERIC(18,2);
ALTER TABLE trading.asset_config ADD COLUMN IF NOT EXISTS volatility_multiplier NUMERIC(4,2);
ALTER TABLE trading.asset_config ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app_auth.users(id);
ALTER TABLE trading.asset_config ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;
ALTER TABLE trading.asset_config ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- ============================================================================
-- pricing.price_ticks critical columns
-- ============================================================================
ALTER TABLE pricing.price_ticks ADD COLUMN IF NOT EXISTS price NUMERIC(18,6);

-- ============================================================================
-- pricing.candles critical columns
-- ============================================================================
ALTER TABLE pricing.candles ADD COLUMN IF NOT EXISTS tick_count INTEGER;

-- ============================================================================
-- reporting.daily_revenue_summary critical columns
-- ============================================================================
-- Materialized views cannot use ALTER TABLE ADD COLUMN
-- Must drop and recreate the view with the new column
DROP MATERIALIZED VIEW IF EXISTS reporting.daily_revenue_summary;

DO $$
DECLARE
    stake_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='stake') THEN
        stake_col := 'stake';
    ELSE
        stake_col := 'stake_amount';
    END IF;

    EXECUTE format('
    CREATE MATERIALIZED VIEW reporting.daily_revenue_summary AS
    SELECT
      DATE(tr.created_at) AS report_date,
      COALESCE(SUM(CASE WHEN d.status = ''completed'' THEN d.net_amount ELSE 0 END), 0) AS total_deposits,
      COALESCE(SUM(CASE WHEN w.status = ''completed'' THEN w.net_amount ELSE 0 END), 0) AS total_withdrawals,
      COALESCE(SUM(tr.%I), 0) AS total_trade_volume,
      COALESCE(
        SUM(CASE
          WHEN tr.status = ''won'' THEN tr.%I
          WHEN tr.status = ''lost'' THEN -tr.potential_payout
          WHEN tr.status = ''draw'' THEN 0
          ELSE 0
        END),
        0
      ) AS platform_revenue,
      COUNT(*) AS trade_count,
      COUNT(DISTINCT tr.user_id) AS active_users,
      COUNT(DISTINCT CASE WHEN DATE(u.created_at) = DATE(tr.created_at) THEN u.id END) AS new_users
    FROM trading.binary_contracts tr
    LEFT JOIN payments.deposits d ON DATE(d.created_at) = DATE(tr.created_at)
    LEFT JOIN payments.withdrawals w ON DATE(w.created_at) = DATE(tr.created_at)
    LEFT JOIN app_auth.users u ON DATE(u.created_at) = DATE(tr.created_at)
    GROUP BY DATE(tr.created_at)', stake_col, stake_col);
END $$;

-- Recreate the unique index on the refreshed view
CREATE UNIQUE INDEX IF NOT EXISTS daily_revenue_summary_date_idx ON reporting.daily_revenue_summary(report_date);
