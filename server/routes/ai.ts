import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";
import { isInInventory, ingredientMatch } from "../utils/ingredientMatch.js";

const router = Router();

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
    "元气早餐": ["早餐", "快手菜"],
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

    // ════════════════════════════════════════
    // 第一阶段：本地规则快速筛候选
    // ════════════════════════════════════════

    // 1) 获取冰箱食材
    const { data: ingredients } = await supabase
      .from("ingredients")
      .select("name, amount, category, expiry_days")
      .eq("user_id", req.userId!)
      .order("expiry_days", { ascending: true });

    // 2) 获取用户偏好
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("restrictions, taste_preferences")
      .eq("user_id", req.userId!)
      .single();

    // 3) 从菜谱库筛选候选（排除旧 AI 生成菜谱，只用种子菜谱）
    const { data: allRecipes } = await supabase
      .from("recipes")
      .select("*")
      .not("id", "like", "ai_%")
      .order("created_at", { ascending: false });

    const sceneTags = getSceneTags(mealType || "正餐");
    const maxMinutes = getMaxMinutes(prepTime || "30分钟内");
    const restrictions = profile?.restrictions || [];
    const inventoryNames = (ingredients || []).map((i: any) => i.name);

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
      // 场景标签匹配（只算原始场景标签）
      const tagScore = (r.tags || []).reduce((score: number, tag: string) =>
        sceneTags.includes(tag) ? score + 2 : score, 0);

      // 口味偏好加分/减分（权重更高，确保口味偏好有实际影响力）
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

      // combinedTagScore 用于硬筛判断（场景+口味标签都算匹配）
      const combinedTagScore = (r.tags || []).reduce((score: number, tag: string) =>
        combinedTags.includes(tag) ? score + 1 : score, 0);

      return { ...r, _tagScore: tagScore, _combinedTagScore: combinedTagScore, _score: tagScore + inventoryScore + tasteScore, _inventoryMatched: matchedCount, _tasteScore: tasteScore };
    });

    // 先硬筛：只保留至少有1个标签匹配的菜谱（场景标签 OR 口味标签）
    const tagMatched = candidates.filter((r: any) => r._combinedTagScore > 0);
    if (tagMatched.length >= 3) {
      candidates = tagMatched;
      console.log(`[AI] Hard tag filter: kept ${candidates.length} tag-matched recipes`);
    } else {
      console.log(`[AI] Hard tag filter: only ${tagMatched.length} matched, keeping all ${candidates.length}`);
    }

    // 按分数排序，取前 20 个
    candidates.sort((a: any, b: any) => b._score - a._score);
    candidates = candidates.slice(0, 20);

    console.log(`[AI] Stage 1: Filtered ${candidates.length} candidates from ${allRecipes?.length || 0} total recipes`);
    console.log(`[AI] Top candidates: ${candidates.slice(0, 5).map((c: any) => `${c.name}(score=${c._score},inv=${c._inventoryMatched},taste=${c._tasteScore})`).join(", ")}`);

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

    const ingredientList = (ingredients || [])
      .map((i: any) => `${i.name}(${i.amount}, 剩余${i.expiry_days}天)`)
      .join("、");

    const savedTastes = profile?.taste_preferences?.join("、") || "无";
    const restrictionStr = restrictions.join("、") || "无";

    // 构建候选列表（精简格式）——用模糊匹配重新分类 have/missing
    const candidateSummary = candidates.map((r: any, idx: number) => {
      const tags = (r.tags || []).join(",");
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

    const prompt = `从以下${candidates.length}道候选菜品中，选出最适合用户的5道。

## 用户条件
- 就餐人数：${peopleCount || "2人"}
- 烹饪时间：${prepTime || "30分钟内"}
- 餐食类型：${mealType || "正餐"}
- 口味偏好：${tastePreference || savedTastes}
- 忌口：${restrictionStr}

## 当前冰箱食材
${ingredientList || "暂无食材"}

## 候选菜品
${candidateSummary}

## 要求
1. 最重要：优先选择"库存匹配"数量最多的菜品，能用到更多库存食材的菜排在前面
2. 临期食材优先使用
3. 注意"库存已有"字段表示用户冰箱里已经有的食材，匹配数越多越应该优先推荐
4. 选出5道菜，返回每道菜的序号、推荐理由、匹配度

## 输出格式（严格JSON，不要markdown标记）
[
  {
    "index": 1,
    "recommendationReason": "推荐理由（简短一句话）",
    "matchPercentage": 85,
    "inventoryMatch": 3,
    "ingredientsHave": [{"name": "食材名", "amount": "用量"}],
    "ingredientsMissing": [{"name": "食材名", "amount": "用量"}]
  }
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
          recommendationReason: `根据您的库存智能匹配（匹配${realHave.length}种食材）`,
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
              content: "你是一个美食推荐助手。从候选菜品中选出最适合的3道，返回JSON数组。只输出JSON，不要任何额外文字。"
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 512,
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

      // 用当前用户的真实库存重新分类 have/missing
      const allIngredients = [
        ...(sel.ingredientsHave || candidate.ingredients_have || []),
        ...(sel.ingredientsMissing || candidate.ingredients_missing || []),
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
        recommendationReason: sel.recommendationReason || candidate.recommendation_reason || "",
        matchPercentage: sel.matchPercentage || candidate.match_percentage || 80,
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
        recommendationReason: `根据您的库存智能匹配（匹配${realHave.length}种食材）`,
        matchPercentage: allIngs.length > 0 ? Math.round((realHave.length / allIngs.length) * 100) : 60,
        inventoryMatch: realHave.length,
        ingredients: { have: realHave, missing: realMissing },
        steps: c.steps || [],
      });
    }

    console.log(`[AI] Successfully recommended ${savedRecipes.length} recipes`);
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
    "recommendationReason": "推荐理由",
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
          content: "你是一个专业的美食推荐助手。请严格按照用户要求的JSON格式输出。"
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

  const inventoryNames = (ingredients || []).map((i: any) => i.name);

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

export default router;
