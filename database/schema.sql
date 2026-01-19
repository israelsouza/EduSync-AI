-- Database schema and helper functions

-- Enable pgvector extension (run once as superuser)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- TABLE: pedagogical_knowledge_v384
-- Stores precomputed 384-dimension embeddings for RAG
CREATE TABLE IF NOT EXISTS pedagogical_knowledge_v384 (
  id uuid PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(384) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- NOTE / FUTURE:
-- Recommended HNSW/ANN index for fast similarity search (pgvector)
-- Note: Use the appropriate index type supported by your pgvector version.
-- Example with ivfflat + cosine distance:
-- CREATE INDEX IF NOT EXISTS pedagogical_knowledge_v384_embedding_idx
--   ON pedagogical_knowledge_v384
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- FUNCTION: match_documents_v384
-- Returns top-N most similar documents to a query embedding using cosine distance
CREATE OR REPLACE FUNCTION match_documents_v384(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.metadata,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM pedagogical_knowledge_v384 p
  WHERE (filter = '{}'::jsonb OR (filter = '{}'::jsonb) IS FALSE) -- placeholder for future filtering
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- TABLE: offline_queries
-- Stores anonymized offline queries submitted by devices for analytics
-- ONLY WITH USER CONSENT
CREATE TABLE IF NOT EXISTS offline_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  response text,
  timestamp timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  device_id text,
  app_version text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offline_queries_timestamp_idx ON offline_queries (timestamp);

-- TABLE: embedding_versions
-- Tracks published embedding bundle versions distributed to devices
CREATE TABLE IF NOT EXISTS embedding_versions (
  version text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  notes text
);

-- Notes / Future: dynamic-dimension approach (Option C)
-- Example DDL (not applied by default):
-- CREATE TABLE pedagogical_knowledge (
--   id uuid PRIMARY KEY,
--   content text,
--   metadata jsonb,
--   embedding vector,  -- variable dimension (use specific vector(N) in queries)
--   dimension int,
--   model_name text,
--   created_at timestamptz DEFAULT now()
-- );
-- And create separate indexes per-dimension (WHERE dimension = 384) for ANN search.

-- End of schema
