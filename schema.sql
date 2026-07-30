CREATE TABLE IF NOT EXISTS library_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cat TEXT NOT NULL,
  content TEXT NOT NULL,
  date BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON library_items FOR ALL USING (true);
