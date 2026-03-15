.PHONY: dev build migrate test down

dev:
	docker compose up dev

build:
	docker compose build

migrate:
	@echo "To run migrations:"
	@echo "1. Go to your Supabase project SQL Editor"
	@echo "2. Run the SQL files in supabase/migrations/ in order:"
	@echo "   - 001_rm_source_resumes.sql"
	@echo "   - 002_rm_bullets_staging.sql"
	@echo "   - 003_rm_claims.sql"
	@echo "   - 004_rm_skills_intros.sql"
	@echo ""
	@echo "Or use: npx supabase db push"

test:
	node lib/dedup/hash.test.ts

down:
	docker compose down
