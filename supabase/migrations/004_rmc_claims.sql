-- Migration 004 — Atomic Claims
CREATE TABLE IF NOT EXISTS rmc_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id UUID REFERENCES rmc_experience_staging(id),
  company_id UUID REFERENCES rmc_companies(id),
  raw_text TEXT NOT NULL,
  rewritten_sentence TEXT,
  tech_stack TEXT[],
  metric_type TEXT,
  metric_value TEXT,
  scope TEXT,
  enrichment_status TEXT DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending','enriched','skipped')),
  conversation_transcript JSONB,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
