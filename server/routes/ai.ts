import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";
import { isInInventory, ingredientMatch } from "../utils/ingredientMatch.js";

const router = Router();

// ── 生成自然、有温度的推荐理由 ──
function buildRecommendReason(dishName: string, _description: string, haveNames: string[], tags: string[]): string {
  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const ingStr = haveNames.slice(0, 3).join("、");
  const suffix = haveNames.length > 3 ? "等" : "";
  const tag = (tags && tags.length > 0) ? tags[0] : "";

  // 有匹配食材时的模板池（不引用 description，自成一句）
  const withIngs = [
    `冰箱里的${ingStr}${suffix}正好派上用场，做一道${dishName}犒劳自己吧～`,
    `家里有${ingStr}${suffix}？那这道${dishName}简直是为你量身定做的！`,
    `${ingStr}${suffix}快要过期了？赶紧安排一道${dishName}消灭它们！`,
    `${ingStr}${suffix}别闲着啦，搭配起来做${dishName}刚刚好～`,
    `正好冰箱有${ingStr}${suffix}，来一道${dishName}，省事又好吃！`,
    `${ingStr}${suffix}和${dishName}简直是天生一对，试试看！`,
  ];

  // 无匹配食材时的模板池（不引用 description，自成一句）
  const noIngs = [
    `今天就来点不一样的吧，${dishName}绝对不会让你失望～`,
    `${dishName}——${tag ? tag + '爱好者' : '吃货'}不能错过的一道菜！`,
    `想换换口味的话，${dishName}是个超棒的选择！`,
    `${tag ? '想吃' + tag + '？' : ''}试试${dishName}吧，好吃到停不下来～`,
    `给今天加点惊喜，来一道${dishName}怎么样？`,
  ];

  return haveNames.length > 0 ? pick(withIngs) : pick(noIngs);
}

// ── 场景 → 标签映射 ──
function getSceneTags(mealType: string): string[] {
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

// ── 时间 → 分钟上限 ──
function getMaxMinutes(prepTime: string): number {
  if (prepTime.includes("15")) return 15;
  if (prepTime.includes("30")) return 30;
  if (prepTime.includes("45")) return 45;
  if (prepTime.includes("60") || prepTime.includes("1小时")) return 60;
  return 999;
}

// ── 口味偏好 → 标签映射 ──
function getTasteTags(taste: string): { boost: string[]; penalize: string[] } {
  const map: Record<string, { boost: string[]; penalize: string[] }> = {
    "香辣": { boost: ["川菜", "湘菜", "麻辣", "火锅", "下饭菜"], penalize: ["清淡", "蒸菜", "轻食", "甜品", "糖水"] },
    "清淡": { boost: ["清淡", "蒸菜", "轻食", "低卡"], penalize: ["麻辣", "火锅", "川菜", "湘菜"] },
    "咸香": { boost: ["家常菜", "下饭菜", "硬菜"], penalize: ["甜品", "糖水", "蛋糕"] },
    "甜口": { boost: ["甜品", "小食", "蛋糕", "糖水"], penalize: ["麻辣", "家常菜", "硬菜", "下饭菜", "川菜", "湘菜", "蒸菜"] },
  };
  return map[taste] || { boost: [], penalize: [] };
}

// ── 从 time 字段解析分钟数 ──
function parseMinutes(time: string): number {
  const m = time.match(/(\d+)/);
  return m ? parseInt(m[1]) : 30;
}

// POST /api/ai/recommend - AI 智能推荐菜品（两阶段）
router.post("/recommend", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    const modelId = process.env.ARK_MODEL_ID || "doubao-1.5-pro-256k-250115";

    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY not configured in .env.local" });
      return;
    }

    const { peopleCount, prepTime, mealType, tastePreference, useInventory } = req.body;

    const t0 = Date.now();

    // ════════════════════════════════════════
    // 第一阶段：本地规则快速筛候选
    // ════════════════════════════════════════

    // 并行查询：食材、偏好、菜谱库（互不依赖）
    const [{ data: ingredients }, { data: profile }, { data: allRecipes }] = await Promise.all([
      supabase
        .from("ingredients")
        .select("name, amount, category, expiry_days")
        .eq("user_id", req.userId!)
        .order("expiry_days", { ascending: true }),
      supabase
        .from("user_profiles")
        .select("restrictions, taste_preferences")
        .eq("user_id", req.userId!)
        .single(),
      supabase
        .from("recipes")
        .select("*")
        .not("id", "like", "ai_%")
        .order("created_at", { ascending: false }),
    ]);

    const t1 = Date.now();
    console.log(`[AI][Perf] DB queries (ingredients + profile + recipes): ${t1 - t0}ms`);

    const sceneTags = getSceneTags(mealType || "正餐");
    const maxMinutes = getMaxMinutes(prepTime || "30分钟内");
    const restrictions = profile?.restrictions || [];
    const validIngredients = (ingredients || []).filter((i: any) => (i.expiry_days || 0) > 0);
    const inventoryNames = validIngredients.map((i: any) => i.name);

    let candidates = (allRecipes || [])
      // 过滤时间
      .filter((r: any) => parseMinutes(r.time || "30分钟") <= maxMinutes)
      // 过滤忌口
      .filter((r: any) => {
        if (restrictions.length === 0) return true;
        const recipeName = r.name || "";
        const recipeDesc = r.description || "";
        return !restrictions.some((ban: string) =>
          recipeName.includes(ban) || recipeDesc.includes(ban)
        );
      });

    // 提取每道菜的全部所需食材（合并 have + missing），用于和当前库存比对
    const getRecipeAllIngredients = (r: any): string[] => {
      const names: string[] = [];
      for (const ing of (r.ingredients_have || [])) {
        if (ing.name) names.push(ing.name);
      }
      for (const ing of (r.ingredients_missing || [])) {
        if (ing.name) names.push(ing.name);
      }
      // 也从菜名和步骤中提取关键词（简单匹配库存食材名）
      const text = `${r.name || ""} ${r.description || ""} ${(r.steps || []).join(" ")}`;
      for (const invName of inventoryNames) {
        if (text.includes(invName) && !names.includes(invName)) {
          names.push(invName);
        }
      }
      return names;
    };

    // 创建临期权重表：越快过期，权重越高
    const expiryWeights: Record<string, number> = {};
    for (const ing of (ingredients || [])) {
      const days = ing.expiry_days || 999;
      // 3天内过期 → 权重5，7天 → 3，14天 → 2，其他 → 1
      expiryWeights[ing.name] = days <= 3 ? 5 : days <= 7 ? 3 : days <= 14 ? 2 : 1;
    }

    // 口味偏好标签
    const tasteTags = getTasteTags(tastePreference || "");

    // 将口味偏好标签合并到场景标签中，确保口味相关菜品不会被硬筛移除
    const combinedTags = [...new Set([...sceneTags, ...tasteTags.boost])];

    // 重新计算分数：标签 + 库存匹配（含临期加权）+ 口味偏好
    candidates = candidates.map((r: any) => {
      // 场景标签匹配（权重高，确保场景相关菜品排在前面）
      const tagScore = (r.tags || []).reduce((score: number, tag: string) =>
        sceneTags.includes(tag) ? score + 10 : score, 0);

      // 口味偏好加分/减分
      let tasteScore = 0;
      for (const tag of (r.tags || [])) {
        if (tasteTags.boost.includes(tag)) tasteScore += 8;
        if (tasteTags.penalize.includes(tag)) tasteScore -= 10;
      }

      let inventoryScore = 0;
      let matchedCount = 0;
      if (useInventory !== false) {
        const allNeeded = getRecipeAllIngredients(r);
        for (const name of allNeeded) {
          if (isInInventory(name, inventoryNames)) {
            // 找到匹配的库存食材的临期权重
            const matchedInv = inventoryNames.find(inv => ingredientMatch(inv, name));
            inventoryScore += (expiryWeights[matchedInv || name] || 1) * 3;
            matchedCount++;
          }
        }
      }

      // 场景标签匹配分数（用于硬筛）
      const sceneTagHits = (r.tags || []).reduce((score: number, tag: string) =>
        sceneTags.includes(tag) ? score + 1 : score, 0);
      // combinedTagScore 用于兜底硬筛
      const combinedTagScore = (r.tags || []).reduce((score: number, tag: string) =>
        combinedTags.includes(tag) ? score + 1 : score, 0);

      return { ...r, _tagScore: tagScore, _sceneTagHits: sceneTagHits, _combinedTagScore: combinedTagScore, _score: tagScore + inventoryScore + tasteScore, _inventoryMatched: matchedCount, _tasteScore: tasteScore };
    });

    // 硬筛：场景标签必须匹配，不匹配直接排除
    const sceneMatched = candidates.filter((r: any) => r._sceneTagHits > 0);
    if (sceneMatched.length >= 3) {
      candidates = sceneMatched;
      console.log(`[AI] Hard scene filter: kept ${candidates.length} scene-matched recipes`);
    } else {
      // 场景匹配不足 3 道，放宽到口味标签兜底
      const tagMatched = candidates.filter((r: any) => r._combinedTagScore > 0);
      if (tagMatched.length >= 3) {
        candidates = tagMatched;
        console.log(`[AI] Hard scene filter: only ${sceneMatched.length} scene-matched, relaxed to ${candidates.length} combined-matched`);
      } else {
        console.log(`[AI] Hard scene filter: only ${tagMatched.length} matched, keeping all ${candidates.length}`);
      }
    }

    // 按分数排序，取前 20 个
    candidates.sort((a: any, b: any) => b._score - a._score);
    candidates = candidates.slice(0, 20);

    console.log(`[AI] Stage 1: Filtered ${candidates.length} candidates from ${allRecipes?.length || 0} total recipes`);
    console.log(`[AI] Top candidates: ${candidates.slice(0, 5).map((c: any) => `${c.name}(score=${c._score},inv=${c._inventoryMatched},taste=${c._tasteScore})`).join(", ")}`);

    const t2 = Date.now();
    console.log(`[AI][Perf] Stage 1 scoring + filtering: ${t2 - t1}ms`);

    // 如果候选不足 3 个，或者最佳候选的标签完全不匹配（库里没有相关菜谱），回退到完整生成模式
    const bestTagScore = candidates.length > 0
      ? (candidates[0].tags || []).reduce((s: number, t: string) => sceneTags.includes(t) ? s + 1 : s, 0)
      : 0;

    if (candidates.length < 3 || bestTagScore === 0) {
      console.log(`[AI] Falling back to full generation (candidates=${candidates.length}, bestTagScore=${bestTagScore})`);
      return await fullGeneration(req, res, apiKey, modelId, ingredients, profile, {
        peopleCount, prepTime, mealType, tastePreference, useInventory,
      });
    }

    // ════════════════════════════════════════
    // 第二阶段：让模型排序和包装
    // ════════════════════════════════════════

    const ingredientList = validIngredients
      .map((i: any) => `${i.name}(${i.amount}, 剩余${i.expiry_days}天)`)
      .join("、");

    const savedTastes = profile?.taste_preferences?.join("、") || "无";
    const restrictionStr = restrictions.join("、") || "无";

    // 构建候选列表——根据是否使用库存决定展示格式
    const candidateSummary = candidates.map((r: any, idx: number) => {
      const tags = (r.tags || []).join(",");
      if (useInventory === false) {
        return `${idx + 1}. ${r.name} | 标签:${tags} | 时间:${r.time} | 难度:${r.difficulty}`;
      }
      // 合并原始食材列表，用当前用户库存重新判断 have/missing
      const allIngs = [...(r.ingredients_have || []), ...(r.ingredients_missing || [])];
      const realHave: string[] = [];
      const realMissing: string[] = [];
      for (const ing of allIngs) {
        if (ing.name && isInInventory(ing.name, inventoryNames)) {
          realHave.push(ing.name);
        } else if (ing.name) {
          realMissing.push(ing.name);
        }
      }
      return `${idx + 1}. ${r.name} | 标签:${tags} | 时间:${r.time} | 难度:${r.difficulty} | 库存已有:${realHave.join(",") || "无"} | 额外需要:${realMissing.join(",") || "无"} | 库存匹配${realHave.length}种`;
    }).join("\n");

    // 根据是否使用库存构建不同的 prompt 段落
    const inventorySection = useInventory !== false
      ? `\n## 当前冰箱食材\n${ingredientList || "暂无食材"}\n`
      : "";

    const requirementsSection = useInventory !== false
      ? `## 要求
1. 最重要：优先选择"库存匹配"数量最多的菜品，能用到更多库存食材的菜排在前面
2. 临期食材优先使用
3. 选出5道菜，只返回序号和推荐理由
4. **推荐理由风格**：像朋友随口推荐，自然、轻松、有温度。可以提食材或菜品特色，禁用"完美利用""智能匹配"等词汇。30-50字。`
      : `## 要求
1. 根据用户的口味偏好和餐食类型，选出最合适的5道菜
2. 优先考虑菜品多样性，避免推荐口味或类型雷同的菜
3. 选出5道菜，只返回序号和推荐理由
4. **推荐理由风格**：像朋友随口推荐，自然、轻松、有温度。侧重介绍菜品特色和口味亮点，禁用"完美利用""智能匹配"等词汇。30-50字。`;

    const prompt = `从以下${candidates.length}道候选菜品中，选出最适合用户的5道。

## 用户条件
- 就餐人数：${peopleCount || "2人"}
- 烹饪时间：${prepTime || "30分钟内"}
- 餐食类型：${mealType || "正餐"}
- 口味偏好：${tastePreference || savedTastes}
- 忌口：${restrictionStr}
${inventorySection}
## 候选菜品
${candidateSummary}

${requirementsSection}

## 输出格式（严格JSON，不要markdown标记）
[
  {"index": 1, "reason": "推荐理由"},
  {"index": 3, "reason": "推荐理由"}
]`;

    const arkEndpoint = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    console.log(`[AI] Stage 2: Calling model ${modelId} to rank candidates`);

    // ── 构建 Stage 1 直接返回的降级函数 ──
    const buildFallbackFromStage1 = () => {
      console.log(`[AI] Fallback: returning top 10 from Stage 1 scoring`);
      const top = candidates.slice(0, 10);
      return top.map((c: any) => {
        const allIngs = [...(c.ingredients_have || []), ...(c.ingredients_missing || [])];
        const realHave: any[] = [];
        const realMissing: any[] = [];
        for (const ing of allIngs) {
          if (ing.name && isInInventory(ing.name, inventoryNames)) {
            realHave.push(ing);
          } else {
            realMissing.push(ing);
          }
        }
        return {
          id: c.id,
          name: c.name,
          description: c.description || "",
          image: c.image || "",
          tags: c.tags || [],
          time: c.time || "",
          difficulty: c.difficulty || "",
          calories: c.calories || "",
          recommendationReason: buildRecommendReason(
            c.name, c.description || "",
            useInventory !== false ? realHave.map((i: any) => i.name) : [],
            c.tags || []
          ),
          matchPercentage: allIngs.length > 0 ? Math.round((realHave.length / allIngs.length) * 100) : 60,
          inventoryMatch: realHave.length,
          ingredients: { have: realHave, missing: realMissing },
          steps: c.steps || [],
        };
      });
    };

    // ── 调用 AI（40秒超时）──
    let aiSelections: any[] | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);

      const response = await fetch(arkEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "system",
              content: "你是一个有品味的美食达人朋友。用户请你帮忙挑菜，你说话自然、轻松、有温度，像朋友聊天一样。从候选菜品中选出最适合的5道，返回JSON数组。只输出JSON，不要任何额外文字。"
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 384,
          thinking: { type: "disabled" },
        }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[AI] Ark API error (${response.status}):`, errBody);
      } else {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        console.log(`[AI] Model response received, usage: ${JSON.stringify(data.usage || {})}`);
        let jsonStr = text.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        aiSelections = JSON.parse(jsonStr);
      }
    } catch (aiErr: any) {
      console.warn(`[AI] Stage 2 failed (${aiErr.name === 'AbortError' ? 'timeout 40s' : aiErr.message}), falling back to Stage 1 results`);
    }

    const t3 = Date.now();
    console.log(`[AI][Perf] Stage 2 AI call: ${t3 - t2}ms`);

    // ── AI 失败时用 Stage 1 排序直接返回 ──
    if (!aiSelections || !Array.isArray(aiSelections) || aiSelections.length === 0) {
      const fallback = buildFallbackFromStage1();
      console.log(`[AI] Returned ${fallback.length} recipes from Stage 1 fallback`);
      return res.json(fallback);
    }

    // ════════════════════════════════════════
    // 拼接最终结果
    // ════════════════════════════════════════

    const savedRecipes = [];
    for (const sel of aiSelections.slice(0, 5)) {
      const idx = (sel.index || 1) - 1;
      const candidate = candidates[idx];
      if (!candidate) continue;

      // 用后端自己计算的库存匹配，不依赖 AI 返回
      const allIngredients = [
        ...(candidate.ingredients_have || []),
        ...(candidate.ingredients_missing || []),
      ];
      const realHave: any[] = [];
      const realMissing: any[] = [];
      for (const ing of allIngredients) {
        if (ing.name && isInInventory(ing.name, inventoryNames)) {
          realHave.push(ing);
        } else {
          realMissing.push(ing);
        }
      }

      const finalRecipe = {
        id: candidate.id,
        name: candidate.name,
        description: candidate.description || "",
        image: candidate.image || "",
        tags: candidate.tags || [],
        time: candidate.time || "",
        difficulty: candidate.difficulty || "",
        calories: candidate.calories || "",
        recommendationReason: sel.reason || sel.recommendationReason || candidate.recommendation_reason || "",
        matchPercentage: allIngredients.length > 0 ? Math.round((realHave.length / allIngredients.length) * 100) : 60,
        inventoryMatch: realHave.length,
        ingredients: {
          have: realHave,
          missing: realMissing,
        },
        steps: candidate.steps || [],
      };

      // 只更新 AI 生成的菜谱，不要污染种子菜谱（种子菜谱是共享资源）
      if (candidate.id?.startsWith("ai_")) {
        await supabase
          .from("recipes")
          .update({
            recommendation_reason: finalRecipe.recommendationReason,
            match_percentage: finalRecipe.matchPercentage,
            inventory_match: finalRecipe.inventoryMatch,
            ingredients_have: finalRecipe.ingredients.have,
            ingredients_missing: finalRecipe.ingredients.missing,
          })
          .eq("id", candidate.id);
      }

      savedRecipes.push(finalRecipe);
    }

    // 用 Stage 1 排序的剩余候选填充到 10 个
    const usedIds = new Set(savedRecipes.map((r: any) => r.id));
    const remaining = candidates.filter((c: any) => !usedIds.has(c.id));
    for (const c of remaining) {
      if (savedRecipes.length >= 10) break;
      const allIngs = [...(c.ingredients_have || []), ...(c.ingredients_missing || [])];
      const realHave: any[] = [];
      const realMissing: any[] = [];
      for (const ing of allIngs) {
        if (ing.name && isInInventory(ing.name, inventoryNames)) {
          realHave.push(ing);
        } else {
          realMissing.push(ing);
        }
      }
      savedRecipes.push({
        id: c.id,
        name: c.name,
        description: c.description || "",
        image: c.image || "",
        tags: c.tags || [],
        time: c.time || "",
        difficulty: c.difficulty || "",
        calories: c.calories || "",
        recommendationReason: buildRecommendReason(
          c.name, c.description || "",
          realHave.map((i: any) => i.name),
          c.tags || []
        ),
        matchPercentage: allIngs.length > 0 ? Math.round((realHave.length / allIngs.length) * 100) : 60,
        inventoryMatch: realHave.length,
        ingredients: { have: realHave, missing: realMissing },
        steps: c.steps || [],
      });
    }

    console.log(`[AI] Successfully recommended ${savedRecipes.length} recipes`);
    const t4 = Date.now();
    console.log(`[AI][Perf] Result assembly: ${t4 - t3}ms`);
    console.log(`[AI][Perf] ══ TOTAL: ${t4 - t0}ms ══`);
    res.json(savedRecipes);
  } catch (err: any) {
    console.error("POST /api/ai/recommend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 回退：候选不足时完整生成 ──
async function fullGeneration(
  req: Request, res: Response,
  apiKey: string, modelId: string,
  ingredients: any[] | null, profile: any,
  filters: any,
) {
  const { peopleCount, prepTime, mealType, tastePreference, useInventory } = filters;

  const ingredientList = (ingredients || [])
    .map((i: any) => `${i.name}(${i.amount}, 剩余${i.expiry_days}天)`)
    .join("、");

  const restrictions = profile?.restrictions?.join("、") || "无";
  const savedTastes = profile?.taste_preferences?.join("、") || "无";

  const prompt = `你是一个专业的中文美食推荐AI助手。请根据以下条件推荐5道菜品。

## 用户条件
- 就餐人数：${peopleCount || "2人"}
- 烹饪时间：${prepTime || "30分钟内"}
- 餐食类型：${mealType || "正餐"}
- 口味偏好：${tastePreference || savedTastes}
- 忌口：${restrictions}
${useInventory !== false ? `- 优先使用库存：是` : "- 优先使用库存：否"}

## 当前冰箱食材
${ingredientList || "暂无食材"}

## 要求
1. 推荐5道菜，尽量利用现有食材（如果选择优先使用库存）
2. 临期食材（剩余天数少的）应优先使用
3. 每道菜需要包含详细信息
4. **推荐理由要求**：像朋友聊天时随口推荐美食一样，语气自然、有温度，结合食材和菜品特色，30-50字。绝对不能用"完美利用""智能匹配""根据库存"这类机械式用语。

## 输出格式
请严格按以下JSON格式回复，不要添加任何额外文字或markdown标记：
[
  {
    "name": "菜名",
    "description": "一句话描述",
    "tags": ["标签1"],
    "time": "预计时间",
    "difficulty": "简单/中等/困难",
    "calories": "预估热量如 350 kcal",
    "recommendationReason": "推荐理由（像朋友推荐一样自然，提及食材或菜品特色）",
    "matchPercentage": 85,
    "inventoryMatch": 3,
    "ingredients": {
      "have": [{"name": "食材名", "amount": "用量"}],
      "missing": [{"name": "食材名", "amount": "用量"}]
    },
    "steps": ["步骤1", "步骤2", "步骤3"]
  }
]`;

  const arkEndpoint = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  console.log(`[AI] Full generation mode with model: ${modelId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  const response = await fetch(arkEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "system",
          content: "你是一个有品味的美食达人朋友。用户给你点菜，你说话自然、轻松、有温度。请严格按照用户要求的JSON格式输出。"
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      thinking: { type: "disabled" },
    }),
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Ark API error: ${response.status} - ${errBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const recipes = JSON.parse(jsonStr);

  const inventoryNames = (ingredients || []).filter((i: any) => (i.expiry_days || 0) > 0).map((i: any) => i.name);

  const savedRecipes = [];
  for (const recipe of recipes) {
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 用真实库存重新分类 have/missing
    const allIngs = [
      ...(recipe.ingredients?.have || []),
      ...(recipe.ingredients?.missing || []),
    ];
    const realHave: any[] = [];
    const realMissing: any[] = [];
    for (const ing of allIngs) {
      if (ing.name && inventoryNames.includes(ing.name)) {
        realHave.push(ing);
      } else {
        realMissing.push(ing);
      }
    }

    const { data: dbData, error } = await supabase
      .from("recipes")
      .insert({
        id,
        name: recipe.name,
        description: recipe.description || "",
        image: "",
        tags: recipe.tags || [],
        time: recipe.time || "",
        difficulty: recipe.difficulty || "",
        calories: recipe.calories || "",
        recommendation_reason: recipe.recommendationReason || "",
        match_percentage: recipe.matchPercentage || null,
        inventory_match: realHave.length,
        ingredients_have: realHave,
        ingredients_missing: realMissing,
        steps: recipe.steps || [],
      })
      .select()
      .single();

    if (!error && dbData) {
      savedRecipes.push({
        id: dbData.id,
        name: dbData.name,
        description: dbData.description,
        image: dbData.image,
        tags: dbData.tags || [],
        time: dbData.time,
        difficulty: dbData.difficulty,
        calories: dbData.calories,
        recommendationReason: dbData.recommendation_reason,
        matchPercentage: dbData.match_percentage,
        inventoryMatch: dbData.inventory_match,
        ingredients: {
          have: dbData.ingredients_have || [],
          missing: dbData.ingredients_missing || [],
        },
        steps: dbData.steps || [],
      });
    } else {
      savedRecipes.push({ id, ...recipe, ingredients: { have: realHave, missing: realMissing } });
    }
  }

  console.log(`[AI] Full generation: ${savedRecipes.length} recipes created`);
  res.json(savedRecipes);
}

// POST /api/ai/recognize-image - 拍照识别食材
router.post("/recognize-image", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ARK_API_KEY;
    const modelId = process.env.ARK_VISION_MODEL_ID || process.env.ARK_MODEL_ID || "doubao-1.5-pro-256k-250115";
    const arkEndpoint = process.env.ARK_API_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY not configured" });
      return;
    }

    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "No image provided" });
      return;
    }

    console.log(`[AI] Recognizing image, size: ${Math.round(image.length / 1024)}KB`);

    const today = new Date().toISOString().split("T")[0];

    const prompt = `请仔细观察这张照片，识别照片中的食材/食品。

## 要求
1. 识别照片中最主要的一种食材或食品
2. 估算其数量和合适的单位
3. 判断其分类
4. 购买日期默认为今天：${today}
5. 根据食材类型估算合理的保存天数

## 分类选项（只能从以下选择）
蔬菜、水果、蛋奶肉类、海鲜水产、主食干货、豆制品、调料、饮品、零食、其他

## 单位选项（只能从以下选择）
克、千克、个、瓶、盒、袋

## 输出格式（严格JSON，不要markdown标记，不要额外文字）
{
  "name": "食材名称",
  "category": "分类",
  "amount": "数量（纯数字）",
  "unit": "单位",
  "purchaseDate": "${today}",
  "expiryDays": "保存天数（纯数字）"
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(arkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 256,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[AI] Vision API error (${response.status}):`, errBody);
      res.status(500).json({ error: `Vision API error: ${response.status}` });
      return;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`[AI] Vision response: ${text}`);

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonStr);
    console.log(`[AI] Recognized ingredient: ${result.name} (${result.category})`);

    res.json(result);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[AI] Vision recognition timeout");
      res.status(504).json({ error: "识别超时，请重试" });
    } else {
      console.error("[AI] Vision recognition error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});
// GET /api/ai/home-picks - 首页三菜推荐（纯规则引擎，秒开）
router.get("/home-picks", async (req: Request, res: Response) => {
  try {
    const t0 = Date.now();

    // ── 并行查询所有需要的数据 ──
    const [
      { data: ingredients },
      { data: profile },
      { data: allRecipes },
      { data: historyData },
      { data: favoritesData },
    ] = await Promise.all([
      supabase
        .from("ingredients")
        .select("name, amount, category, expiry_days")
        .eq("user_id", req.userId!)
        .order("expiry_days", { ascending: true }),
      supabase
        .from("user_profiles")
        .select("restrictions, taste_preferences")
        .eq("user_id", req.userId!)
        .single(),
      supabase
        .from("recipes")
        .select("*")
        .not("id", "like", "ai_%")
        .order("created_at", { ascending: false }),
      supabase
        .from("history")
        .select("recipe_id, recipes(tags)")
        .eq("user_id", req.userId!)
        .order("viewed_at", { ascending: false })
        .limit(50),
      supabase
        .from("favorites")
        .select("recipe_id, recipes(tags)")
        .eq("user_id", req.userId!)
        .limit(50),
    ]);

    const t1 = Date.now();
    console.log(`[HomePicks][Perf] DB queries: ${t1 - t0}ms`);

    const recipes = allRecipes || [];
    const inventoryNames = (ingredients || []).filter((i: any) => (i.expiry_days || 0) > 0).map((i: any) => i.name);
    const restrictions = profile?.restrictions || [];
    const tastePrefs = profile?.taste_preferences || [];

    // 过滤忌口
    const safeRecipes = recipes.filter((r: any) => {
      if (restrictions.length === 0) return true;
      const text = `${r.name || ""} ${r.description || ""}`;
      return !restrictions.some((ban: string) => text.includes(ban));
    });

    // 格式化函数
    const formatPick = (r: any, slot: string, hint: string) => {
      const allIngs = [...(r.ingredients_have || []), ...(r.ingredients_missing || [])];
      const realHave: any[] = [];
      const realMissing: any[] = [];
      for (const ing of allIngs) {
        if (ing.name && isInInventory(ing.name, inventoryNames)) {
          realHave.push(ing);
        } else {
          realMissing.push(ing);
        }
      }
      return {
        id: r.id,
        name: r.name,
        description: r.description || "",
        image: r.image || "",
        tags: r.tags || [],
        time: r.time || "",
        difficulty: r.difficulty || "",
        calories: r.calories || "",
        slot,
        hint,
        recommendationReason: hint,
        matchPercentage: allIngs.length > 0 ? Math.round((realHave.length / allIngs.length) * 100) : 0,
        inventoryMatch: realHave.length,
        ingredients: { have: realHave, missing: realMissing },
        steps: r.steps || [],
      };
    };

    const usedIds = new Set<string>();
    const picks: any[] = [];

    // ═══════════════════════════════════
    // Slot 1：临期消耗型
    // ═══════════════════════════════════
    let slot1 = null;
    const urgentIngs = (ingredients || []).filter((i: any) => (i.expiry_days || 999) <= 14);

    if (urgentIngs.length > 0) {
      // 找临期最紧迫的食材
      const mostUrgent = urgentIngs[0]; // 已按 expiry_days 升序排
      // 从菜谱里找能用到这个食材的菜，按库存匹配度排序
      let bestMatch: any = null;
      let bestMatchCount = 0;
      for (const r of safeRecipes) {
        const allNeeded = [...(r.ingredients_have || []), ...(r.ingredients_missing || [])];
        const names = allNeeded.map((i: any) => i.name).filter(Boolean);
        // 必须用到临期食材
        if (!names.some((n: string) => ingredientMatch(mostUrgent.name, n))) continue;
        // 计算总库存匹配度
        let matchCount = 0;
        for (const n of names) {
          if (isInInventory(n, inventoryNames)) matchCount++;
        }
        if (matchCount > bestMatchCount) {
          bestMatchCount = matchCount;
          bestMatch = r;
        }
      }
      if (bestMatch) {
        const days = mostUrgent.expiry_days;
        const hint = days <= 1
          ? `冰箱里的${mostUrgent.name}今天就要过期了`
          : `冰箱里的${mostUrgent.name}还有 ${days} 天过期`;
        slot1 = formatPick(bestMatch, "expiry", hint);
        usedIds.add(bestMatch.id);
      }
    }

    // 兜底：库存匹配度最高
    if (!slot1) {
      let best: any = null;
      let bestCount = 0;
      for (const r of safeRecipes) {
        const allNeeded = [...(r.ingredients_have || []), ...(r.ingredients_missing || [])];
        let matchCount = 0;
        for (const ing of allNeeded) {
          if (ing.name && isInInventory(ing.name, inventoryNames)) matchCount++;
        }
        if (matchCount > bestCount) {
          bestCount = matchCount;
          best = r;
        }
      }
      if (best) {
        slot1 = formatPick(best, "expiry", bestCount > 0 ? `可以用到冰箱里 ${bestCount} 种食材` : "为你精选的今日推荐");
        usedIds.add(best.id);
      }
    }
    if (slot1) picks.push(slot1);

    // ═══════════════════════════════════
    // Slot 2：场景适配型
    // ═══════════════════════════════════
    const hour = req.query.hour ? parseInt(req.query.hour as string) : new Date().getHours();
    let timeTags: string[];
    let timeHint: string;
    if (hour < 4) {
      timeTags = ["宵夜", "小吃", "面条", "炒饭", "快手菜"];
      timeHint = "深夜食堂";
    } else if (hour >= 4 && hour < 10) {
      timeTags = ["早餐", "轻食", "小食"];
      timeHint = "适合早餐";
    } else if (hour >= 10 && hour < 14) {
      timeTags = ["家常菜", "快手菜", "下饭菜", "硬菜"];
      timeHint = "适合午餐";
    } else if (hour >= 14 && hour < 17) {
      timeTags = ["甜品", "小食", "轻食", "饮品", "茶饮"];
      timeHint = "适合下午茶";
    } else if (hour >= 17 && hour < 21) {
      timeTags = ["家常菜", "硬菜", "汤羹", "下饭菜"];
      timeHint = "适合晚餐";
    } else {
      timeTags = ["宵夜", "小吃", "面条", "炒饭", "快手菜"];
      timeHint = "深夜食堂";
    }

    // 按标签匹配 + 口味偏好打分
    const slot2Candidates = safeRecipes
      .filter((r: any) => !usedIds.has(r.id))
      .map((r: any) => {
        let score = 0;
        for (const tag of (r.tags || [])) {
          if (timeTags.includes(tag)) score += 3;
        }
        // 口味偏好加分
        for (const taste of tastePrefs) {
          const tt = getTasteTags(taste);
          for (const tag of (r.tags || [])) {
            if (tt.boost.includes(tag)) score += 2;
            if (tt.penalize.includes(tag)) score -= 3;
          }
        }
        return { ...r, _score: score };
      })
      .filter((r: any) => r._score > 0)
      .sort((a: any, b: any) => b._score - a._score);

    if (slot2Candidates.length > 0) {
      const chosen = slot2Candidates[0];
      picks.push(formatPick(chosen, "timeslot", timeHint));
      usedIds.add(chosen.id);
    }

    // ═══════════════════════════════════
    // Slot 3：探索惊喜型
    // ═══════════════════════════════════
    // 收集用户已接触过的标签
    const touchedTags = new Set<string>();
    for (const h of (historyData || [])) {
      const tags = (h as any).recipes?.tags;
      if (tags) for (const t of tags) touchedTags.add(t);
    }
    for (const f of (favoritesData || [])) {
      const tags = (f as any).recipes?.tags;
      if (tags) for (const t of tags) touchedTags.add(t);
    }

    const touchedRecipeIds = new Set<string>();
    for (const h of (historyData || [])) touchedRecipeIds.add((h as any).recipe_id);
    for (const f of (favoritesData || [])) touchedRecipeIds.add((f as any).recipe_id);

    // 找标签不在已接触集合中的菜品，但口味偏好仍要匹配
    let slot3Candidates = safeRecipes
      .filter((r: any) => !usedIds.has(r.id) && !touchedRecipeIds.has(r.id))
      .map((r: any) => {
        const tags = r.tags || [];
        // 新鲜度：有多少标签是用户没接触过的
        const newTagCount = tags.filter((t: string) => !touchedTags.has(t)).length;
        // 口味兼容性
        let tasteScore = 0;
        for (const taste of tastePrefs) {
          const tt = getTasteTags(taste);
          for (const tag of tags) {
            if (tt.boost.includes(tag)) tasteScore += 2;
            if (tt.penalize.includes(tag)) tasteScore -= 3;
          }
        }
        return { ...r, _newness: newTagCount, _tasteScore: tasteScore, _score: newTagCount * 2 + tasteScore };
      })
      .filter((r: any) => r._newness > 0 && r._tasteScore >= 0)
      .sort((a: any, b: any) => b._score - a._score);

    if (slot3Candidates.length > 0) {
      picks.push(formatPick(slot3Candidates[0], "discovery", "新发现"));
      usedIds.add(slot3Candidates[0].id);
    } else {
      // 降级：随机推荐一道用户没浏览过的菜
      const unseen = safeRecipes.filter((r: any) => !usedIds.has(r.id) && !touchedRecipeIds.has(r.id));
      if (unseen.length > 0) {
        const random = unseen[Math.floor(Math.random() * unseen.length)];
        picks.push(formatPick(random, "discovery", "新发现"));
        usedIds.add(random.id);
      }
    }

    const t2 = Date.now();
    console.log(`[HomePicks][Perf] Logic: ${t2 - t1}ms, TOTAL: ${t2 - t0}ms`);
    console.log(`[HomePicks] Returned ${picks.length} picks: ${picks.map(p => `${p.slot}:${p.name}`).join(", ")}`);

    res.json(picks);
  } catch (err: any) {
    console.error("GET /api/ai/home-picks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
