-- Migration 003 — Experience Staging
CREATE TABLE IF NOT EXISTS rmc_experience_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_resume_id UUID REFERENCES rmc_source_resumes(id) ON DELETE CASCADE,
  company_id UUID REFERENCES rmc_companies(id),
  company_name_raw TEXT,
  raw_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_duplicate BOOLEAN DEFAULT false,
  canonical_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_hash)
);
