-- Migration 012: Events schema tables
-- Creates tables for event outbox as per DDS §5.39

-- events.event_outbox
CREATE TABLE IF NOT EXISTS events.event_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  aggregate_type VARCHAR(30) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  retry_count SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for events schema
CREATE INDEX IF NOT EXISTS event_outbox_unpublished_idx ON events.event_outbox(created_at) WHERE published = FALSE;
CREATE INDEX IF NOT EXISTS event_outbox_aggregate_idx ON events.event_outbox(aggregate_type, aggregate_id);
