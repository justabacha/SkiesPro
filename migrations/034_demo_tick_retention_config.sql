-- Allow the scheduled demo-feed cleanup to use the configured retention window.
DROP FUNCTION IF EXISTS pricing.prune_expired_demo_ticks();

CREATE OR REPLACE FUNCTION pricing.prune_expired_demo_ticks(retention_days INTEGER DEFAULT 30)
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  IF retention_days IS NULL OR retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be a positive integer'
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM pricing.price_ticks tick
   WHERE tick.source = 'demo'
     AND tick.tick_time < NOW() - make_interval(days => retention_days)
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
