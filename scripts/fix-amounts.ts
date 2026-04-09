import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * 精确化映射表
 * 
 * 根据食材名 + 原始用量 → 精确计量
 * 通用规则：
 *   - "少许" 调味粉类 → 2g, 液体类 → 3ml
 *   - "适量" 调味料 → 5g, 蔬菜 → 30g, 油类 → 10ml 
 *   - "1勺" 液体调料 → 15ml, 粉类 → 8g, 酱类 → 15g
 *   - "半勺" → 对应减半
 *   - "1小勺" → 5ml 或 3g
 *   - "1盒" 豆腐 → 300g, 牛奶 → 250ml
 *   - "1包" → 视具体食材
 *   - "1块" 牛排/豆腐 → 约250g, 方便面 → 100g
 *   - "X份" 面条 → 每份150g
 *   - "X碗" 米饭 → 每碗200g
 *   - "X杯" 大米 → 每杯180g
 *   - "1把" 蔬菜 → 100g, 小葱 → 30g
 */

// 食材专属映射（食材名 → { 原始amount: 新amount }）
const SPECIFIC_MAP: Record<string, Record<string, string>> = {
  // === 豆腐类 ===
  "嫩豆腐":   { "1盒": "300g" },
  "豆腐":     { "1块": "250g", "1盒": "300g" },
  
  // === 面条/米饭/主食 ===
  "面条":     { "2份": "300g", "1份": "150g" },
  "日式拉面": { "2份": "300g" },
  "凉皮":     { "2份": "300g" },
  "米饭":     { "2碗": "400g", "1碗": "200g" },
  "大米":     { "2杯": "360g", "1杯": "180g" },
  "寿司米":   { "2碗": "400g" },
  
  // === 包装食材 ===
  "螺蛳粉米粉": { "1包": "200g" },
  "手指饼干":   { "1包": "200g" },
  "方便面":     { "1块": "100g" },
  "全麦饼皮":   { "2张": "120g" },
  
  // === 肉类 ===
  "牛排":     { "1块": "250g" },
  "鸡腿排":   { "2块": "400g" },
  
  // === 蔬菜/小葱 ===
  "小葱":     { "1把": "30g" },
  "小油菜":   { "1把": "100g" },
};

// 通用模糊量 → 精确量（按食材类型）
// 调味料液体
const LIQUID_CONDIMENTS = new Set([
  "生抽", "老抽", "酱油", "蚝油", "料酒", "香醋", "醋", "白醋",
  "蒸鱼豉油", "香油", "食用油", "橄榄油", "辣椒油", "花生油",
  "照烧汁", "寿司醋", "油醋汁", "番茄酱", "甜面酱", "黄豆酱",
  "辣酱", "豆瓣酱", "郫县豆瓣酱", "韩式辣酱", "冬阴功酱",
  "芝麻酱", "豆豉", "剁椒", "酸奶酱", "辣油", "花椒油",
]);

const POWDER_CONDIMENTS = new Set([
  "盐", "糖", "白糖", "细砂糖", "冰糖", "黑糖", "黑胡椒",
  "花椒粉", "五香粉", "味精", "鸡精", "可可粉", "海盐",
  "花椒", "胡椒粉",
]);

const STARCH_FLOUR = new Set([
  "淀粉", "玉米淀粉", "面粉", "中筋面粉", "炼乳",
]);

function convertAmount(ingredientName: string, originalAmount: string): string {
  // 1) 检查食材专属映射
  if (SPECIFIC_MAP[ingredientName]?.[originalAmount]) {
    return SPECIFIC_MAP[ingredientName][originalAmount];
  }

  // 2) 已经是精确克/ml/个等，不改
  if (/^\d+(\.\d+)?\s*(g|ml|毫升|克|千克|kg)$/i.test(originalAmount)) {
    return originalAmount;
  }

  // 3) 通用模糊量替换
  const isLiquid = LIQUID_CONDIMENTS.has(ingredientName);
  const isPowder = POWDER_CONDIMENTS.has(ingredientName);
  const isStarch = STARCH_FLOUR.has(ingredientName);

  // 「少许」
  if (originalAmount === "少许") {
    if (isLiquid) return "3ml";
    if (isPowder) return "2g";
    return "3g";
  }

  // 「适量」
  if (originalAmount === "适量") {
    if (isLiquid) return "10ml";
    if (isPowder) return "5g";
    if (isStarch) return "10g";
    // 蔬菜/其他
    if (["姜末", "葱花", "香菜", "小青菜"].includes(ingredientName)) return "20g";
    if (ingredientName === "冰块") return "100g";
    return "5g";
  }

  // 「X勺」→ 液体15ml/勺, 酱类15g/勺, 粉类8g/勺
  const spoonMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*勺$/);
  if (spoonMatch) {
    const n = parseFloat(spoonMatch[1]);
    if (isLiquid) return `${n * 15}ml`;
    if (isPowder) return `${n * 8}g`;
    if (isStarch) return `${n * 8}g`;
    // 酱类默认15g/勺
    return `${n * 15}ml`;
  }

  // 「半勺」
  if (originalAmount === "半勺") {
    if (isLiquid) return "8ml";
    if (isPowder) return "4g";
    return "8ml";
  }

  // 「X小勺」→ 5ml/小勺
  const tspMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*小勺$/);
  if (tspMatch) {
    const n = parseFloat(tspMatch[1]);
    if (isPowder) return `${n * 3}g`;
    return `${n * 5}ml`;
  }

  // 「X碗」→ 200g/碗（汤水类250ml）
  const bowlMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*碗$/);
  if (bowlMatch) {
    const n = parseFloat(bowlMatch[1]);
    return `${n * 200}g`;
  }

  // 「X杯」→ 180g/杯
  const cupMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*杯$/);
  if (cupMatch) {
    const n = parseFloat(cupMatch[1]);
    return `${n * 180}g`;
  }

  // 「X份」→ 150g/份
  const portionMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*份$/);
  if (portionMatch) {
    const n = parseFloat(portionMatch[1]);
    return `${n * 150}g`;
  }

  // 「X把」→ 蔬菜100g/把
  const bunchMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*把$/);
  if (bunchMatch) {
    const n = parseFloat(bunchMatch[1]);
    return `${n * 80}g`;
  }

  // 「X盒/包/块」→ 按通用重量
  const packageMatch = originalAmount.match(/^(\d+(\.\d+)?)\s*(盒|包|块)$/);
  if (packageMatch) {
    const n = parseFloat(packageMatch[1]);
    const unit = packageMatch[3];
    if (unit === "盒") return `${n * 250}g`;
    if (unit === "包") return `${n * 200}g`;
    if (unit === "块") return `${n * 200}g`;
  }

  // 保留不动的单位: 个、只、根、片、瓣、颗、条、枝、张
  // 这些是计件单位，含义明确
  if (/^\d+(\.\d+)?\s*(个|只|根|片|瓣|颗|条|枝|张)$/.test(originalAmount)) {
    return originalAmount;
  }

  // 特殊：半个/半根
  if (/^半(个|根)$/.test(originalAmount)) {
    return originalAmount;
  }

  // 含分数: 1/3个
  if (/^\d+\/\d+(个|根)$/.test(originalAmount)) {
    return originalAmount;
  }

  // 其他不处理
  return originalAmount;
}

async function main() {
  const { data: recipes, error } = await s.from("recipes").select("id, name, ingredients_have, ingredients_missing");
  if (error) { console.error(error); return; }

  let totalChanged = 0;
  const changes: Array<{ recipe: string; ingredient: string; old: string; new: string }> = [];

  for (const recipe of recipes || []) {
    let changed = false;

    const updateList = (list: any[] | null): any[] => {
      if (!list) return [];
      return list.map((item: any) => {
        const newAmount = convertAmount(item.name, item.amount);
        if (newAmount !== item.amount) {
          changes.push({ recipe: recipe.name, ingredient: item.name, old: item.amount, new: newAmount });
          changed = true;
          return { ...item, amount: newAmount };
        }
        return item;
      });
    };

    const newHave = updateList(recipe.ingredients_have);
    const newMissing = updateList(recipe.ingredients_missing);

    if (changed) {
      totalChanged++;
      const { error: updateErr } = await s
        .from("recipes")
        .update({
          ingredients_have: newHave,
          ingredients_missing: newMissing,
        })
        .eq("id", recipe.id);

      if (updateErr) {
        console.error(`❌ Failed to update ${recipe.name}:`, updateErr.message);
      } else {
        console.log(`✅ ${recipe.name} updated`);
      }
    }
  }

  console.log(`\n========= 总结 =========`);
  console.log(`共修改 ${totalChanged} 道菜谱，${changes.length} 个食材用量\n`);
  console.log("修改明细:");
  changes.forEach(c => {
    console.log(`  [${c.recipe}] ${c.ingredient}: "${c.old}" → "${c.new}"`);
  });
}

main();
