-- Bloc Studio: Mind Maps

BEGIN;

-- Mind maps table
CREATE TABLE IF NOT EXISTS nbk.mindmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    title TEXT NOT NULL,
    query TEXT,
    doc_ids UUID[],
    version INT NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mind map nodes
CREATE TABLE IF NOT EXISTS nbk.mindmap_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mindmap_id UUID NOT NULL REFERENCES nbk.mindmaps(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    summary TEXT,
    citations JSONB NOT NULL DEFAULT '[]',
    position JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
    cluster_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mind map edges
CREATE TABLE IF NOT EXISTS nbk.mindmap_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mindmap_id UUID NOT NULL REFERENCES nbk.mindmaps(id) ON DELETE CASCADE,
    source UUID NOT NULL REFERENCES nbk.mindmap_nodes(id) ON DELETE CASCADE,
    target UUID NOT NULL REFERENCES nbk.mindmap_nodes(id) ON DELETE CASCADE,
    weight FLOAT NOT NULL DEFAULT 0.0,
    UNIQUE(mindmap_id, source, target)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS mindmap_workspace_idx ON nbk.mindmaps(workspace_id);
CREATE INDEX IF NOT EXISTS mindmap_created_idx ON nbk.mindmaps(created_at DESC);
CREATE INDEX IF NOT EXISTS mindmap_nodes_map_idx ON nbk.mindmap_nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS mindmap_edges_map_idx ON nbk.mindmap_edges(mindmap_id);
CREATE INDEX IF NOT EXISTS mindmap_edges_source_idx ON nbk.mindmap_edges(source);
CREATE INDEX IF NOT EXISTS mindmap_edges_target_idx ON nbk.mindmap_edges(target);

-- GIN index for citations JSONB
CREATE INDEX IF NOT EXISTS mindmap_nodes_citations_idx ON nbk.mindmap_nodes USING GIN (citations);

COMMIT;
