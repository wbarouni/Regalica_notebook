-- Rollback Bloc Studio: Workspaces & RBAC

BEGIN;

-- Remove FK constraint from mindmaps
ALTER TABLE IF EXISTS nbk.mindmaps DROP CONSTRAINT IF EXISTS mindmaps_workspace_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS nbk.studio_logs_metadata_idx;
DROP INDEX IF EXISTS nbk.studio_logs_created_idx;
DROP INDEX IF EXISTS nbk.studio_logs_severity_idx;
DROP INDEX IF EXISTS nbk.studio_logs_event_idx;
DROP INDEX IF EXISTS nbk.studio_logs_ws_idx;
DROP INDEX IF EXISTS nbk.workspace_docs_quarantined_idx;
DROP INDEX IF EXISTS nbk.workspace_docs_doc_idx;
DROP INDEX IF EXISTS nbk.workspace_docs_ws_idx;
DROP INDEX IF EXISTS nbk.workspace_members_role_idx;
DROP INDEX IF EXISTS nbk.workspace_members_user_idx;
DROP INDEX IF EXISTS nbk.workspace_members_ws_idx;
DROP INDEX IF EXISTS nbk.workspace_created_idx;
DROP INDEX IF EXISTS nbk.workspace_name_idx;

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS nbk.studio_logs CASCADE;
DROP TABLE IF EXISTS nbk.workspace_docs CASCADE;
DROP TABLE IF EXISTS nbk.workspace_members CASCADE;
DROP TABLE IF EXISTS nbk.workspaces CASCADE;

COMMIT;
