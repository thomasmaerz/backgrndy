# Supabase Migrations

To run migrations:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Paste each migration file in order (001 → 006)
5. Run each migration separately

## Migration Order

- `001_rmc_source_resumes.sql` - Source resumes table
- `002_rmc_companies.sql` - Companies table
- `003_rmc_experience_staging.sql` - Experience staging table
- `004_rmc_claims.sql` - Atomic claims table
- `005_rmc_skills.sql` - Skills table with append function
- `006_rmc_education_credentials.sql` - Education & credentials table
