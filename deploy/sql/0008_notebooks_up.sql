-- Migration 0008: Notebooks system
-- Adds tables for notebook management, session history, and document binding

-- Main notebooks table
CREATE TABLE IF NOT EXISTS nbk.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notebooks_created ON nbk.notebooks(created_at DESC);
CREATE INDEX idx_notebooks_updated ON nbk.notebooks(updated_at DESC);

-- Session/chat history for each notebook
CREATE TABLE IF NOT EXISTS nbk.notebook_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES nbk.notebooks(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sessions_notebook ON nbk.notebook_sessions(notebook_id, created_at DESC);
CREATE INDEX idx_sessions_role ON nbk.notebook_sessions(notebook_id, role);

-- Link notebooks to documents
CREATE TABLE IF NOT EXISTS nbk.notebook_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES nbk.notebooks(id) ON DELETE CASCADE,
  document_id integer NOT NULL REFERENCES nbk.documents(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE(notebook_id, document_id)
);

CREATE INDEX idx_notebook_docs_notebook ON nbk.notebook_documents(notebook_id);
CREATE INDEX idx_notebook_docs_document ON nbk.notebook_documents(document_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION nbk.update_notebook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notebooks_updated
  BEFORE UPDATE ON nbk.notebooks
  FOR EACH ROW
  EXECUTE FUNCTION nbk.update_notebook_timestamp();

-- Comments for documentation
COMMENT ON TABLE nbk.notebooks IS 'User notebooks for organizing documents and chat sessions';
COMMENT ON TABLE nbk.notebook_sessions IS 'Chat history for each notebook (user questions + AI answers)';
COMMENT ON TABLE nbk.notebook_documents IS 'Links between notebooks and uploaded documents';
