-- Migration UP pour la table rag_logs

CREATE TABLE IF NOT EXISTS nbk.rag_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  lang varchar(5),
  topk int,
  retrieved jsonb,
  reranked jsonb,
  answer jsonb,
  confidence numeric,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE nbk.rag_logs IS 'Logs des requêtes RAG pour analyse et débogage';
COMMENT ON COLUMN nbk.rag_logs.query IS 'Requête de l''utilisateur';
COMMENT ON COLUMN nbk.rag_logs.lang IS 'Langue détectée de la requête';
COMMENT ON COLUMN nbk.rag_logs.topk IS 'Nombre de candidats récupérés';
COMMENT ON COLUMN nbk.rag_logs.retrieved IS 'Candidats récupérés (avant reranking)';
COMMENT ON COLUMN nbk.rag_logs.reranked IS 'Candidats réordonnés (après reranking)';
COMMENT ON COLUMN nbk.rag_logs.answer IS 'Réponse générée par le LLM';
COMMENT ON COLUMN nbk.rag_logs.confidence IS 'Score de confiance de la réponse';

