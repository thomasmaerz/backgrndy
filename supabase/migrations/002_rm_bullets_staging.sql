-- Migration 002: Staging Bullets Table

CREATE TABLE IF NOT EXISTS rm_bullets_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_resume_id UUID REFERENCES rm_source_resumes(id) ON DELETE CASCADE,
  raw_bullet TEXT NOT NULL,
  bullet_hash TEXT NOT NULL,
  section TEXT CHECK (section IN ('experience','skills','intro','other')),
  is_duplicate BOOLEAN DEFAULT false,
  canonical_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bullet_hash)
);

CREATE INDEX IF NOT EXISTS idx_rm_bullets_staging_source_resume_id ON rm_bullets_staging(source_resume_id);
CREATE INDEX IF NOT EXISTS idx_rm_bullets_staging_is_duplicate ON rm_bullets_staging(is_duplicate);
