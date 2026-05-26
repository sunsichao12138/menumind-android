-- ============================================
-- 003: 菜谱营养成分表
-- ============================================

CREATE TABLE IF NOT EXISTS recipe_nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  calories NUMERIC,           -- 总热量 kcal
  protein NUMERIC,            -- 蛋白质 g
  fat NUMERIC,                -- 脂肪 g
  carbs NUMERIC,              -- 碳水化合物 g
  fiber NUMERIC,              -- 膳食纤维 g
  sodium NUMERIC,             -- 钠 mg
  sugar NUMERIC,              -- 糖 g
  detail JSONB DEFAULT '[]',  -- 每种食材的营养明细
  source TEXT DEFAULT 'ai',   -- 数据来源: 'ai' | 'manual' | 'api'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_recipe ON recipe_nutrition(recipe_id);
