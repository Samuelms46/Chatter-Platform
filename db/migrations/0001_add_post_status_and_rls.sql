-- 1) Add columns if they don't exist
ALTER TABLE IF EXISTS posts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Optional: index for faster sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts (updated_at DESC);

-- 3) Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 4) Policy: allow anyone to read published posts
CREATE POLICY "allow_select_published" ON posts
  FOR SELECT
  USING (is_published = true);

-- 5) Policy: allow users to read their own posts (drafts and published)
CREATE POLICY "allow_select_own" ON posts
  FOR SELECT
  USING (auth.role() = 'authenticated' AND author_id = auth.uid());

-- 6) Policy: allow authenticated users to insert/update/delete their own posts
CREATE POLICY "users_manage_own_posts" ON posts
  FOR ALL
  USING (auth.role() = 'authenticated' AND author_id = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND author_id = auth.uid());

-- 7) Trigger to keep updated_at fresh on updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON posts;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();