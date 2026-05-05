// ─────────────────────────────────────────────
// 重排层：LLM 排序 + 候选不足时走完整生成
// ─────────────────────────────────────────────

import { supabase } from "../supabase.js";
import type {
  ScoredRecipe,
  UserContext,
  RequestFilters,
  FinalRecipe,
} from "./types.js";
import { splitIngredientsByInventory } from "./format.js";

export interface LlmConfig {
  apiKey: string;
  modelId: string;
  endpoint: string;
}

export interface AiSelection {
  index: number;
  reason: string;
}

// ── 调用豆包对 Top-N 候选进行重排，选出 5 道并生成理由 ──
export async function llmRerank(
  candidates: ScoredRecipe[],
  ctx: UserContext,
  filters: RequestFilters,
  llm: LlmConfig
): Promise<AiSelection[] | null> {
  const ingredientList = ctx.validIngredients
    .map((i: any) => `${i.name}(${i.amount}, 剩余${i.expiry_days}天)`)
    .join("、");
  const savedTastes = ctx.savedTastes.join("、") || "无";
  const restrictionStr = ctx.restrictions.join("、") || "无";

  // 候选清单展示
  const candidateSummary = candidates
    .map((s, idx) => {
      const r = s.recipe;
      const tags = (r.tags || []).join(",");
      if (!filters.useInventory) {
        return `${idx + 1}. ${r.name} | 标签:${tags} | 时间:${r.time} | 难度:${r.difficulty}`;
      }
      const { have, missing } = splitIngredientsByInventory(r, ctx.inventoryNames);
      const haveStr = have.map((i: any) => i.name).join(",") || "无";
      const missingStr = missing.map((i: any) => i.name).join(",") || "无";
      return `${idx + 1}. ${r.name} | 标签:${tags} | 时间:${r.time} | 难度:${r.difficulty} | 库存已有:${haveStr} | 额外需要:${missingStr} | 库存匹配${have.length}种`;
    })
    .join("\n");

  const inventorySection = filters.useInventory
    ? `\n## 当前冰箱食材\n${ingredientList || "暂无食材"}\n`
    : "";

  const requirementsSection = filters.useInventory
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
- 就餐人数：${filters.peopleCount}
- 烹饪时间：${filters.prepTime}
- 餐食类型：${filters.mealType}
- 口味偏好：${filters.tastePreference || savedTastes}
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

  console.log(`[Rerank] Calling model ${llm.modelId} to rank ${candidates.length} candidates`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);
    const response = await fetch(llm.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${llm.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: llm.modelId,
        messages: [
          {
            role: "system",
            content:
              "你是一个有品味的美食达人朋友。用户请你帮忙挑菜，你说话自然、轻松、有温度，像朋友聊天一样。从候选菜品中选出最适合的5道，返回JSON数组。只输出JSON，不要任何额外文字。",
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
      console.error(`[Rerank] Ark API error (${response.status}):`, errBody);
      return null;
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`[Rerank] Model response received, usage: ${JSON.stringify(data.usage || {})}`);
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(jsonStr);
  } catch (err: any) {
    console.warn(
      `[Rerank] LLM call failed (${err.name === "AbortError" ? "timeout 40s" : err.message})`
    );
    return null;
  }
}

// ── 候选不足时：让 LLM 完整生成 5 道菜（不依赖菜谱库）──
export async function fullGeneration(
  ctx: UserContext,
  filters: RequestFilters,
  llm: LlmConfig
): Promise<FinalRecipe[]> {
  const ingredientList = ctx.ingredients
    .map((i: any) => `${i.name}(${i.amount}, 剩余${i.expiry_days}天)`)
    .join("、");
  const restrictions = ctx.restrictions.join("、") || "无";
  const savedTastes = ctx.savedTastes.join("、") || "无";

  const prompt = `你是一个专业的中文美食推荐AI助手。请根据以下条件推荐5道菜品。

## 用户条件
- 就餐人数：${filters.peopleCount}
- 烹饪时间：${filters.prepTime}
- 餐食类型：${filters.mealType}
- 口味偏好：${filters.tastePreference || savedTastes}
- 忌口：${restrictions}
${filters.useInventory ? `- 优先使用库存：是` : "- 优先使用库存：否"}

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

  console.log(`[FullGen] Full generation mode with model: ${llm.modelId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  const response = await fetch(llm.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${llm.apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: llm.modelId,
      messages: [
        {
          role: "system",
          content:
            "你是一个有品味的美食达人朋友。用户给你点菜，你说话自然、轻松、有温度。请严格按照用户要求的JSON格式输出。",
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
  const inventoryNames = ctx.inventoryNames;

  const savedRecipes: FinalRecipe[] = [];
  for (const recipe of recipes) {
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
      savedRecipes.push({
        id,
        name: recipe.name,
        description: recipe.description || "",
        image: "",
        tags: recipe.tags || [],
        time: recipe.time || "",
        difficulty: recipe.difficulty || "",
        calories: recipe.calories || "",
        recommendationReason: recipe.recommendationReason || "",
        matchPercentage: recipe.matchPercentage || 60,
        inventoryMatch: realHave.length,
        ingredients: { have: realHave, missing: realMissing },
        steps: recipe.steps || [],
      });
    }
  }
  console.log(`[FullGen] Generated ${savedRecipes.length} recipes`);
  return savedRecipes;
}

// 从环境变量构造 LLM 配置
export function loadLlmConfig(): LlmConfig | null {
  const apiKey = process.env.ARK_API_KEY;
  const modelId = process.env.ARK_MODEL_ID || "doubao-1.5-pro-256k-250115";
  const endpoint =
    process.env.ARK_API_ENDPOINT ||
    "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  if (!apiKey) return null;
  return { apiKey, modelId, endpoint };
}
