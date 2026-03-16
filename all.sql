-- Migration 001 — Source Resumes
CREATE TABLE IF NOT EXISTS rmc_source_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf','docx','csv')),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  raw_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','parsed','failed'))
);
-- Migration 002 — Companies
CREATE TABLE IF NOT EXISTS rmc_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
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
-- Migration 005 — Skills
CREATE TABLE IF NOT EXISTS rmc_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL UNIQUE,
  category TEXT,
  source_resume_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION rmc_append_skill_source(p_skill TEXT, p_resume_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE rmc_skills
  SET source_resume_ids = array_append(source_resume_ids, p_resume_id)
  WHERE skill = p_skill
    AND NOT (source_resume_ids @> ARRAY[p_resume_id]);
$$;
-- Migration 006 — Education & Credentials
CREATE TABLE IF NOT EXISTS rmc_education_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_resume_id UUID REFERENCES rmc_source_resumes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('degree','training','certification')),
  title TEXT NOT NULL,
  institution TEXT,
  year TEXT,
  content_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
