-- Migration 013: Reporting views
-- Creates materialized views for reporting as per DDS §5.40-5.41

-- reporting.daily_revenue_summary
CREATE MATERIALIZED VIEW IF NOT EXISTS reporting.daily_revenue_summary AS
SELECT 
  DATE(tr.created_at) AS report_date,
  COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.net_amount ELSE 0 END), 0) AS total_deposits,
  COALESCE(SUM(CASE WHEN w.status = 'completed' THEN w.net_amount ELSE 0 END), 0) AS total_withdrawals,
  COALESCE(SUM(tr.stake_amount), 0) AS total_trade_volume,
  COALESCE(
    SUM(CASE 
      WHEN tr.status = 'won' THEN tr.stake_amount
      WHEN tr.status = 'lost' THEN -tr.potential_payout
      WHEN tr.status = 'draw' THEN 0
      ELSE 0
    END),
    0
  ) AS platform_revenue,
  COUNT(DISTINCT tr.user_id) AS active_users,
  COUNT(DISTINCT CASE WHEN DATE(u.created_at) = DATE(tr.created_at) THEN u.id END) AS new_users
FROM trading.binary_contracts tr
LEFT JOIN payments.deposits d ON DATE(d.created_at) = DATE(tr.created_at)
LEFT JOIN payments.withdrawals w ON DATE(w.created_at) = DATE(tr.created_at)
LEFT JOIN app_auth.users u ON DATE(u.created_at) = DATE(tr.created_at)
GROUP BY DATE(tr.created_at);

-- reporting.daily_trade_summary
CREATE MATERIALIZED VIEW IF NOT EXISTS reporting.daily_trade_summary AS
SELECT 
  DATE(tr.created_at) AS report_date,
  tr.asset_symbol,
  COUNT(*) AS total_trades,
  SUM(CASE WHEN tr.status = 'won' THEN 1 ELSE 0 END) AS win_count,
  SUM(CASE WHEN tr.status = 'lost' THEN 1 ELSE 0 END) AS loss_count,
  SUM(CASE WHEN tr.status = 'draw' THEN 1 ELSE 0 END) AS draw_count,
  SUM(tr.stake_amount) AS total_stake,
  SUM(CASE WHEN tr.status = 'won' THEN tr.potential_payout ELSE 0 END) AS total_payout,
  COALESCE(
    SUM(CASE 
      WHEN tr.status = 'won' THEN tr.stake_amount
      WHEN tr.status = 'lost' THEN -tr.potential_payout
      WHEN tr.status = 'draw' THEN 0
      ELSE 0
    END),
    0
  ) AS net_revenue
FROM trading.binary_contracts tr
GROUP BY DATE(tr.created_at), tr.asset_symbol;

-- Create unique indexes on materialized views
CREATE UNIQUE INDEX IF NOT EXISTS daily_revenue_summary_date_idx ON reporting.daily_revenue_summary(report_date);
CREATE UNIQUE INDEX IF NOT EXISTS daily_trade_summary_date_asset_idx ON reporting.daily_trade_summary(report_date, asset_symbol);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.daily_revenue_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.daily_trade_summary;
END;
$$ LANGUAGE plpgsql;
