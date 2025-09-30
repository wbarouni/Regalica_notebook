-- Migration UP pour les fonctionnalités multi-tenant (Bloc 5)

BEGIN;

-- Création de la table nbk_workspaces
CREATE TABLE IF NOT EXISTS nbk.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Création de la table nbk_users
CREATE TABLE IF NOT EXISTS nbk.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Création de l'ENUM nbk_role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nbk_role') THEN
        CREATE TYPE nbk.nbk_role AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');
    END IF;
END
$$ LANGUAGE plpgsql;

-- Création de la table nbk_memberships
CREATE TABLE IF NOT EXISTS nbk.memberships (
    workspace_id UUID NOT NULL REFERENCES nbk.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES nbk.users(id) ON DELETE CASCADE,
    role nbk.nbk_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- Création de la table nbk_workspace_settings
CREATE TABLE IF NOT EXISTS nbk.workspace_settings (
    workspace_id UUID PRIMARY KEY REFERENCES nbk.workspaces(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajout de la colonne workspace_id aux tables existantes (avec valeur par défaut pour la non-régression)
-- Pour les données existantes, nous allons assigner un UUID par défaut ou NULL si la logique le permet.
-- Pour l'instant, nous allons ajouter la colonne et la rendre nullable, puis une étape ultérieure pourra migrer les données.

ALTER TABLE nbk.documents ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE nbk.pages ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE nbk.chunks ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE nbk.embeddings ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE nbk.rag_logs ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Création de la table nbk_audit_log
CREATE TABLE IF NOT EXISTS nbk.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID REFERENCES nbk.workspaces(id) ON DELETE SET NULL, -- Peut être NULL si l'action n'est pas liée à un workspace spécifique ou si le workspace est supprimé
    user_id UUID REFERENCES nbk.users(id) ON DELETE SET NULL, -- Peut être NULL si l'action n'est pas liée à un utilisateur spécifique ou si l'utilisateur est supprimé
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT, -- ID de l'entité affectée (ex: document_id, chunk_id)
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajout d'index pour les nouvelles colonnes workspace_id
CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON nbk.documents (workspace_id);
CREATE INDEX IF NOT EXISTS pages_workspace_id_idx ON nbk.pages (workspace_id);
CREATE INDEX IF NOT EXISTS chunks_workspace_id_idx ON nbk.chunks (workspace_id);
CREATE INDEX IF NOT EXISTS embeddings_workspace_id_idx ON nbk.embeddings (workspace_id);
CREATE INDEX IF NOT EXISTS rag_logs_workspace_id_idx ON nbk.rag_logs (workspace_id);
CREATE INDEX IF NOT EXISTS audit_log_workspace_id_idx ON nbk.audit_log (workspace_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON nbk.audit_log (user_id);

COMMIT;

