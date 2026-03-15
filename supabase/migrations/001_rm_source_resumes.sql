-- Migration 001: Source Resumes Table

CREATE TABLE IF NOT EXISTS rm_source_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf','docx','csv')),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  raw_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','parsed','failed'))
);
