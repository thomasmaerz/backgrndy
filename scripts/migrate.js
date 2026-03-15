const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  const client = await pool.connect();
  console.log('Connected to database');
  
  try {
    console.log('Running migrations...');
    
    // Migration 001
    await client.query(`
      CREATE TABLE IF NOT EXISTS rm_source_resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('pdf','docx','csv')),
        uploaded_at TIMESTAMPTZ DEFAULT now(),
        raw_text TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','parsed','failed'))
      )
    `);
    console.log('✓ Migration 001: rm_source_resumes');
    
    // Migration 002
    await client.query(`
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
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_bullets_staging_source_resume_id ON rm_bullets_staging(source_resume_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_bullets_staging_is_duplicate ON rm_bullets_staging(is_duplicate)
    `);
    console.log('✓ Migration 002: rm_bullets_staging');
    
    // Migration 003
    await client.query(`
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
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_claims_staging_id ON rm_claims(staging_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_claims_enrichment_status ON rm_claims(enrichment_status)
    `);
    console.log('✓ Migration 003: rm_claims');
    
    // Migration 004
    await client.query(`
      CREATE TABLE IF NOT EXISTS rm_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        skill TEXT NOT NULL UNIQUE,
        category TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rm_skills_sources (
        skill_id UUID REFERENCES rm_skills(id) ON DELETE CASCADE,
        source_resume_id UUID REFERENCES rm_source_resumes(id) ON DELETE CASCADE,
        PRIMARY KEY (skill_id, source_resume_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rm_intros (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rm_intros_sources (
        intro_id UUID REFERENCES rm_intros(id) ON DELETE CASCADE,
        source_resume_id UUID REFERENCES rm_source_resumes(id) ON DELETE CASCADE,
        PRIMARY KEY (intro_id, source_resume_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_skills_skill ON rm_skills(skill)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rm_intros_content_hash ON rm_intros(content_hash)
    `);
    console.log('✓ Migration 004: rm_skills, rm_skills_sources, rm_intros, rm_intros_sources');
    
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get the connection string from environment
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

runMigrations().catch(() => process.exit(1));
