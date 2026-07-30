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

CREATE TABLE IF NOT EXISTS prompt_addons (
  id SERIAL PRIMARY KEY,
  addons JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE prompt_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON prompt_addons FOR ALL USING (true);
INSERT INTO prompt_addons (addons) VALUES ('[]');

CREATE TABLE IF NOT EXISTS usage_data (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE usage_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON usage_data FOR ALL USING (true);
INSERT INTO usage_data (data) VALUES ('{}');
