-- Rollback migration 0008: Notebooks system

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_notebooks_updated ON nbk.notebooks;
DROP FUNCTION IF EXISTS nbk.update_notebook_timestamp();

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS nbk.notebook_documents CASCADE;
DROP TABLE IF EXISTS nbk.notebook_sessions CASCADE;
DROP TABLE IF EXISTS nbk.notebooks CASCADE;
