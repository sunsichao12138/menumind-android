import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync("server/migrations/002_family_and_logs.sql", "utf-8");

// Split by semicolons and run each statement
const statements = sql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

async function run() {
  for (const stmt of statements) {
    console.log("Running:", stmt.substring(0, 60) + "...");
    const { error } = await supabase.rpc("exec_sql", { query: stmt });
    if (error) {
      // Try direct REST approach
      const { error: err2 } = await supabase.from("_").select().limit(0);
      console.log("  -> Note: rpc not available, will use Supabase Dashboard");
      console.log("  -> Statement:", stmt.substring(0, 80));
    } else {
      console.log("  -> OK");
    }
  }
}

run().catch(console.error);
