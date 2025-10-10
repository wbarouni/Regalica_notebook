-- Bloc Studio: Workspaces & RBAC

BEGIN;

-- Workspaces table
CREATE TABLE IF NOT EXISTS nbk.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    confidential BOOLEAN NOT NULL DEFAULT false,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace members with RBAC
CREATE TABLE IF NOT EXISTS nbk.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES nbk.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Workspace documents with quarantine support
CREATE TABLE IF NOT EXISTS nbk.workspace_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES nbk.workspaces(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
    quarantined BOOLEAN NOT NULL DEFAULT false,
    quarantine_reason TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, document_id)
);

-- Studio logs for Guardian alerts and events
CREATE TABLE IF NOT EXISTS nbk.studio_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES nbk.workspaces(id) ON DELETE CASCADE,
    document_id UUID REFERENCES nbk.documents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS workspace_name_idx ON nbk.workspaces(name);
CREATE INDEX IF NOT EXISTS workspace_created_idx ON nbk.workspaces(created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_members_ws_idx ON nbk.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON nbk.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_role_idx ON nbk.workspace_members(role);
CREATE INDEX IF NOT EXISTS workspace_docs_ws_idx ON nbk.workspace_docs(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_docs_doc_idx ON nbk.workspace_docs(document_id);
CREATE INDEX IF NOT EXISTS workspace_docs_quarantined_idx ON nbk.workspace_docs(quarantined) WHERE quarantined = true;
CREATE INDEX IF NOT EXISTS studio_logs_ws_idx ON nbk.studio_logs(workspace_id);
CREATE INDEX IF NOT EXISTS studio_logs_event_idx ON nbk.studio_logs(event_type);
CREATE INDEX IF NOT EXISTS studio_logs_severity_idx ON nbk.studio_logs(severity);
CREATE INDEX IF NOT EXISTS studio_logs_created_idx ON nbk.studio_logs(created_at DESC);

-- GIN index for metadata JSONB
CREATE INDEX IF NOT EXISTS studio_logs_metadata_idx ON nbk.studio_logs USING GIN (metadata);

-- Add workspace_id FK to mindmaps if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'mindmaps_workspace_id_fkey'
        AND table_schema = 'nbk'
        AND table_name = 'mindmaps'
    ) THEN
        ALTER TABLE nbk.mindmaps
        ADD CONSTRAINT mindmaps_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES nbk.workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
