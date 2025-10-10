-- Rollback Bloc Studio: Mind Maps

BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS nbk.mindmap_nodes_citations_idx;
DROP INDEX IF EXISTS nbk.mindmap_edges_target_idx;
DROP INDEX IF EXISTS nbk.mindmap_edges_source_idx;
DROP INDEX IF EXISTS nbk.mindmap_edges_map_idx;
DROP INDEX IF EXISTS nbk.mindmap_nodes_map_idx;
DROP INDEX IF EXISTS mindmap_created_idx;
DROP INDEX IF EXISTS nbk.mindmap_workspace_idx;

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS nbk.mindmap_edges CASCADE;
DROP TABLE IF EXISTS nbk.mindmap_nodes CASCADE;
DROP TABLE IF EXISTS nbk.mindmaps CASCADE;

COMMIT;
