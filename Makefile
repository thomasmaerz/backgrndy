.PHONY: dev build migrate test

dev:
	@echo "Starting development server..."
	yarn dev

build:
	@echo "Building production bundle..."
	yarn build

migrate:
	@echo "=============================================="
	@echo "To run migrations, go to your Supabase dashboard:"
	@echo "https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
	@echo ""
	@echo "Then paste the contents of supabase/migrations/ files"
	@echo "into the SQL editor, in order: 001 through 006"
	@echo "=============================================="

test:
	@echo "Running tests..."
	@echo "(No tests configured yet)"
