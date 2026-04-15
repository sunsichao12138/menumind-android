-- Phase B: Create new tables for family system and ingredient logs

-- 1. families table
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- 3. ingredient_logs table
CREATE TABLE IF NOT EXISTS ingredient_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('add', 'consume', 'expire_warning', 'delete', 'update')),
  ingredient_name text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_logs_user ON ingredient_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_logs_family ON ingredient_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_logs_created ON ingredient_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_families_owner ON families(owner_id);

-- RLS policies (using service role key, so we skip RLS for now)
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON families FOR ALL USING (true);
CREATE POLICY "Service role full access" ON family_members FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ingredient_logs FOR ALL USING (true);
