# Supabase Migrations

## Running Migrations

### Option 1: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

### Option 2: SQL Editor

1. Go to your Supabase project's SQL Editor
2. Copy the contents of each migration file in order:
   - `001_rm_source_resumes.sql`
   - `002_rm_bullets_staging.sql`
   - `003_rm_claims.sql`
   - `004_rm_skills_intros.sql`
3. Run each file sequentially

### Verification

After running migrations, verify tables exist:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'rm_%';
```

You should see:
- rm_source_resumes
- rm_bullets_staging
- rm_claims
- rm_skills
- rm_skills_sources
- rm_intros
- rm_intros_sources
