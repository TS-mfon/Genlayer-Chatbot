CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title_trgm
ON knowledge_entries USING GIN (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_updated_at
ON knowledge_entries (updated_at DESC);

CREATE OR REPLACE FUNCTION search_knowledge_entries_extractive(
  query_text TEXT,
  match_count INT DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  text_rank FLOAT,
  fuzzy_score FLOAT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  WITH normalized AS (
    SELECT
      trim(coalesce(query_text, '')) AS q_text,
      plainto_tsquery('english', trim(coalesce(query_text, ''))) AS q_ts
  )
  SELECT
    k.id,
    k.title,
    k.content,
    k.category,
    k.tags,
    ts_rank(
      to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.content, '')),
      n.q_ts
    ) AS text_rank,
    similarity(lower(coalesce(k.title, '')), lower(n.q_text)) AS fuzzy_score,
    k.updated_at
  FROM knowledge_entries k
  CROSS JOIN normalized n
  WHERE
    k.is_active = TRUE
    AND n.q_text <> ''
    AND (
      to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.content, '')) @@ n.q_ts
      OR lower(coalesce(k.title, '')) % lower(n.q_text)
      OR lower(coalesce(k.title, '')) LIKE '%' || lower(n.q_text) || '%'
    )
  ORDER BY
    (ts_rank(
      to_tsvector('english', coalesce(k.title, '') || ' ' || coalesce(k.content, '')),
      n.q_ts
    ) + similarity(lower(coalesce(k.title, '')), lower(n.q_text)) * 0.5) DESC,
    k.updated_at DESC
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;
