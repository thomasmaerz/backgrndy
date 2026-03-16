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
