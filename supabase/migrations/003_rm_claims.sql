-- Migration 003: Atomic Claims Table

CREATE TABLE IF NOT EXISTS rm_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id UUID REFERENCES rm_bullets_staging(id),
  raw_bullet TEXT NOT NULL,
  role_type TEXT,
  function TEXT,
  tech_stack TEXT[],
  metric_type TEXT,
  metric_value TEXT,
  scope TEXT,
  leadership BOOLEAN DEFAULT false,
  domain TEXT,
  enrichment_status TEXT DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending','enriched','skipped')),
  enrichment_notes TEXT,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rm_claims_staging_id ON rm_claims(staging_id);
CREATE INDEX IF NOT EXISTS idx_rm_claims_enrichment_status ON rm_claims(enrichment_status);
