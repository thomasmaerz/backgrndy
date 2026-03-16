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
