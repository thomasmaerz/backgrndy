-- Migration 004: Deduplicated Skills + Intros with Junction Tables

-- Skills table
CREATE TABLE IF NOT EXISTS rm_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Skills junction table (avoids race conditions on concurrent uploads)
CREATE TABLE IF NOT EXISTS rm_skills_sources (
  skill_id UUID REFERENCES rm_skills(id) ON DELETE CASCADE,
  source_resume_id UUID REFERENCES rm_source_resumes(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, source_resume_id)
);

-- Intros table
CREATE TABLE IF NOT EXISTS rm_intros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intros junction table
CREATE TABLE IF NOT EXISTS rm_intros_sources (
  intro_id UUID REFERENCES rm_intros(id) ON DELETE CASCADE,
  source_resume_id UUID REFERENCES rm_source_resumes(id) ON DELETE CASCADE,
  PRIMARY KEY (intro_id, source_resume_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_skills_skill ON rm_skills(skill);
CREATE INDEX IF NOT EXISTS idx_rm_intros_content_hash ON rm_intros(content_hash);
