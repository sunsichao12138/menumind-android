import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const statements = [
  `CREATE TABLE IF NOT EXISTS recipe_nutrition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    calories NUMERIC,
    protein NUMERIC,
    fat NUMERIC,
    carbs NUMERIC,
    fiber NUMERIC,
    sodium NUMERIC,
    sugar NUMERIC,
    detail JSONB DEFAULT '[]',
    source TEXT DEFAULT 'ai',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(recipe_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nutrition_recipe ON recipe_nutrition(recipe_id)`,
];

async function run() {
  // Test connection
  const { data, error } = await supabase.from("recipes").select("id").limit(1);
  if (error) {
    console.error("Connection failed:", error.message);
    process.exit(1);
  }
  console.log("✅ Supabase connected");

  // Execute each statement via rpc
  for (const sql of statements) {
    console.log("Running:", sql.substring(0, 60) + "...");
    try {
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      if (error) {
        console.log("  ⚠️ rpc not available, trying direct approach...");
        // Cannot run DDL via REST API, print SQL for manual execution
        console.log("  📋 Please run this SQL in Supabase Dashboard SQL Editor:");
        console.log("  " + sql);
      } else {
        console.log("  ✅ OK");
      }
    } catch (e) {
      console.log("  ❌ Error:", e.message);
    }
  }

  // Verify
  const { error: verifyErr } = await supabase
    .from("recipe_nutrition")
    .select("id")
    .limit(1);
  if (!verifyErr) {
    console.log("\n🎉 recipe_nutrition table created successfully!");
  } else {
    console.log("\n⚠️ Table not created via API. Please run the SQL manually:");
    console.log("Go to: https://supabase.com/dashboard → SQL Editor → New Query");
    console.log("Paste the content of: supabase/migrations/003_add_nutrition.sql");
  }
}

run().catch(console.error);
