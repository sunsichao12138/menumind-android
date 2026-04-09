import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: recipes } = await s.from("recipes").select("id, name, ingredients_have, ingredients_missing");

  const allAmounts = new Set<string>();
  recipes?.forEach((r: any) => {
    [...(r.ingredients_have || []), ...(r.ingredients_missing || [])].forEach((i: any) => {
      if (i.amount) allAmounts.add(i.amount);
    });
  });

  // 按种类归类
  const sorted = Array.from(allAmounts).sort();
  console.log(`共 ${sorted.length} 种不同的用量表述:\n`);
  sorted.forEach(a => console.log(`  "${a}"`));

  // 打印每道菜的全部食材
  console.log("\n\n=== 菜谱食材明细 ===");
  recipes?.forEach((r: any) => {
    console.log(`\n【${r.name}】(${r.id})`);
    [...(r.ingredients_have || []), ...(r.ingredients_missing || [])].forEach((i: any) => {
      console.log(`  ${i.name} → ${i.amount}`);
    });
  });
}

main();
