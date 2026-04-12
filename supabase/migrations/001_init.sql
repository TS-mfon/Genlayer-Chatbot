CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  embedding VECTOR(768),
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_active ON knowledge_entries (is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries (category);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_fts
ON knowledge_entries USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_entries_updated_at ON knowledge_entries;
CREATE TRIGGER trg_knowledge_entries_updated_at
BEFORE UPDATE ON knowledge_entries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION match_knowledge_entries(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  query_text TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  WITH scored AS (
    SELECT
      k.id,
      k.title,
      k.content,
      k.category,
      1 - (k.embedding <=> query_embedding) AS vector_similarity,
      ts_rank(
        to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.content, '')),
        plainto_tsquery('english', query_text)
      ) AS keyword_rank
    FROM knowledge_entries k
    WHERE
      k.is_active = TRUE
      AND k.embedding IS NOT NULL
  )
  SELECT
    s.id,
    s.title,
    s.content,
    s.category,
    (s.vector_similarity + LEAST(s.keyword_rank, 1.0) * 0.2) AS similarity
  FROM scored s
  WHERE s.vector_similarity > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
