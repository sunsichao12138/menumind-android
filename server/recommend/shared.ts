// ─────────────────────────────────────────────
// 推荐链路共享 helper（场景/口味映射、时间解析、推荐理由模板）
// ─────────────────────────────────────────────

// 场景 → 标签映射
export function getSceneTags(mealType: string): string[] {
  const map: Record<string, string[]> = {
    // 基础场景
    "正餐": ["家常菜", "硬菜", "下饭菜"],
    "早餐": ["早餐", "快手菜", "轻食"],
    "午餐": ["家常菜", "快手菜", "下饭菜"],
    "晚餐": ["家常菜", "硬菜", "汤羹"],
    "下午茶": ["甜品", "小食", "轻食"],
    "轻食": ["轻食", "沙拉", "低卡"],
    // 首页快捷标签
    "来点甜的": ["甜品", "小食", "蛋糕", "糖水"],
    "喝点东西": ["饮品", "汤羹", "奶茶", "果汁", "茶饮"],
    "喝点儿东西": ["饮品", "汤羹", "奶茶", "果汁", "茶饮"],
    "快速搞定": ["快手菜", "家常菜"],
    "吃饱一点": ["硬菜", "主食", "盖饭", "面条", "下饭菜"],
    "清库存": ["家常菜", "快手菜"],
    "低负担": ["轻食", "沙拉", "低卡", "蒸菜"],
    "家常菜": ["家常菜", "下饭菜"],
    "西式料理": ["西餐", "意面", "牛排", "沙拉"],
    "日韩风味": ["日料", "韩餐", "寿司", "拉面"],
    "火辣过瘾": ["川菜", "湘菜", "麻辣", "火锅"],
    "清爽解腻": ["凉菜", "轻食", "沙拉", "酸味"],
    "高蛋白": ["高蛋白", "鸡胸肉", "牛肉", "鸡蛋"],
    "低碳水": ["低碳水", "轻食", "沙拉", "蒸菜"],
    "深夜食堂": ["宵夜", "小吃", "面条", "炒饭"],
    "元气早餐": ["早餐", "轻食", "小食"],
    "减脂餐": ["减脂", "轻食", "低卡", "沙拉"],
    "宝宝餐": ["儿童餐", "辅食", "蒸菜", "清淡"],
    "微醺调酒": ["鸡尾酒", "调酒", "酒饮", "微醺", "饮品"],
    "微醺": ["鸡尾酒", "调酒", "酒饮", "微醺", "饮品"],
    "饮品": ["饮品", "汤羹", "奶茶", "果汁", "茶饮", "鸡尾酒"],
  };
  return map[mealType] || ["家常菜"];
}

// 口味偏好 → 标签映射
export function getTasteTags(taste: string): { boost: string[]; penalize: string[] } {
  const map: Record<string, { boost: string[]; penalize: string[] }> = {
    "香辣": { boost: ["川菜", "湘菜", "麻辣", "火锅", "下饭菜"], penalize: ["清淡", "蒸菜", "轻食", "甜品", "糖水"] },
    "清淡": { boost: ["清淡", "蒸菜", "轻食", "低卡"], penalize: ["麻辣", "火锅", "川菜", "湘菜"] },
    "咸香": { boost: ["家常菜", "下饭菜", "硬菜"], penalize: ["甜品", "糖水", "蛋糕"] },
    "甜口": { boost: ["甜品", "小食", "蛋糕", "糖水"], penalize: ["麻辣", "家常菜", "硬菜", "下饭菜", "川菜", "湘菜", "蒸菜"] },
  };
  return map[taste] || { boost: [], penalize: [] };
}

// 时间字符串 → 分钟上限
export function getMaxMinutes(prepTime: string): number {
  if (prepTime.includes("15")) return 15;
  if (prepTime.includes("30")) return 30;
  if (prepTime.includes("45")) return 45;
  if (prepTime.includes("60") || prepTime.includes("1小时")) return 60;
  return 999;
}

// 从 recipe.time 字段解析分钟数（如 "30分钟" → 30）
export function parseMinutes(time: string): number {
  const m = time.match(/(\d+)/);
  return m ? parseInt(m[1]) : 30;
}

// ── 时段 → 标签映射（用于 home-picks slot2）──
export function getTimeSlotTags(hour: number): { tags: string[]; hint: string } {
  if (hour < 4) return { tags: ["宵夜", "小吃", "面条", "炒饭", "快手菜"], hint: "深夜食堂" };
  if (hour < 10) return { tags: ["早餐", "轻食", "小食"], hint: "适合早餐" };
  if (hour < 14) return { tags: ["家常菜", "快手菜", "下饭菜", "硬菜"], hint: "适合午餐" };
  if (hour < 17) return { tags: ["甜品", "小食", "轻食", "饮品", "茶饮"], hint: "适合下午茶" };
  if (hour < 21) return { tags: ["家常菜", "硬菜", "汤羹", "下饭菜"], hint: "适合晚餐" };
  return { tags: ["宵夜", "小吃", "面条", "炒饭", "快手菜"], hint: "深夜食堂" };
}

// ── 生成自然、有温度的推荐理由 ──
export function buildRecommendReason(
  dishName: string,
  _description: string,
  haveNames: string[],
  tags: string[]
): string {
  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const ingStr = haveNames.slice(0, 3).join("、");
  const suffix = haveNames.length > 3 ? "等" : "";
  const tag = (tags && tags.length > 0) ? tags[0] : "";

  const withIngs = [
    `冰箱里的${ingStr}${suffix}正好派上用场，做一道${dishName}犒劳自己吧～`,
    `家里有${ingStr}${suffix}？那这道${dishName}简直是为你量身定做的！`,
    `${ingStr}${suffix}快要过期了？赶紧安排一道${dishName}消灭它们！`,
    `${ingStr}${suffix}别闲着啦，搭配起来做${dishName}刚刚好～`,
    `正好冰箱有${ingStr}${suffix}，来一道${dishName}，省事又好吃！`,
    `${ingStr}${suffix}和${dishName}简直是天生一对，试试看！`,
  ];

  const noIngs = [
    `今天就来点不一样的吧，${dishName}绝对不会让你失望～`,
    `${dishName}——${tag ? tag + '爱好者' : '吃货'}不能错过的一道菜！`,
    `想换换口味的话，${dishName}是个超棒的选择！`,
    `${tag ? '想吃' + tag + '？' : ''}试试${dishName}吧，好吃到停不下来～`,
    `给今天加点惊喜，来一道${dishName}怎么样？`,
  ];

  return haveNames.length > 0 ? pick(withIngs) : pick(noIngs);
}

// ── 提取菜谱所需全部食材（含从菜名/步骤中匹配库存的）──
export function getRecipeAllIngredients(r: any, inventoryNames: string[]): string[] {
  const names: string[] = [];
  for (const ing of (r.ingredients_have || [])) {
    if (ing.name) names.push(ing.name);
  }
  for (const ing of (r.ingredients_missing || [])) {
    if (ing.name) names.push(ing.name);
  }
  // 从菜名/描述/步骤中提取库存食材关键词
  const text = `${r.name || ""} ${r.description || ""} ${(r.steps || []).join(" ")}`;
  for (const invName of inventoryNames) {
    if (text.includes(invName) && !names.includes(invName)) {
      names.push(invName);
    }
  }
  return names;
}
