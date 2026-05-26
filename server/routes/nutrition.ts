import { Router, Request, Response } from "express";
import { supabase } from "../supabase.js";

const router = Router();

// ─── POST /api/nutrition/analyze/:recipeId ─── AI 分析菜谱营养成分
router.post("/analyze/:recipeId", async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.params;

    // 1. 检查缓存
    const { data: cached } = await supabase
      .from("recipe_nutrition")
      .select("*")
      .eq("recipe_id", recipeId)
      .single();

    if (cached) {
      console.log(`[Nutrition] Cache hit for recipe ${recipeId}`);
      res.json(formatNutrition(cached));
      return;
    }

    // 2. 获取菜谱信息
    const { data: recipe, error: recipeErr } = await supabase
      .from("recipes")
      .select("id, name, ingredients_have, ingredients_missing")
      .eq("id", recipeId)
      .single();

    if (recipeErr || !recipe) {
      res.status(404).json({ error: "菜谱未找到" });
      return;
    }

    // 3. 合并食材清单
    const allIngredients = [
      ...(recipe.ingredients_have || []),
      ...(recipe.ingredients_missing || []),
    ];

    if (allIngredients.length === 0) {
      res.status(400).json({ error: "该菜谱没有食材信息，无法分析" });
      return;
    }

    // 4. 调用 LLM 分析营养
    const apiKey = process.env.ARK_API_KEY;
    const modelId = process.env.ARK_MODEL_ID || "doubao-1.5-pro-256k-250115";
    const arkEndpoint =
      process.env.ARK_API_ENDPOINT ||
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY not configured" });
      return;
    }

    const ingredientsList = allIngredients
      .map((i: any) => `- ${i.name} ${i.amount}`)
      .join("\n");

    const prompt = `你是一个专业营养师。根据以下菜品的食材清单，估算该菜品烹饪后的总热量和营养成分。

菜品名称：${recipe.name}
食材清单：
${ingredientsList}

## 要求
1. 根据每种食材的用量，估算其营养数值
2. 考虑中式烹饪中的油、盐等调料对热量和钠的影响
3. 汇总为整道菜的总值
4. 数值精确到整数即可

## 输出格式（严格 JSON，不要 markdown 标记，不要额外文字）
{
  "calories": 总热量(kcal数字),
  "protein": 蛋白质(g数字),
  "fat": 脂肪(g数字),
  "carbs": 碳水化合物(g数字),
  "fiber": 膳食纤维(g数字),
  "sodium": 钠(mg数字),
  "sugar": 糖(g数字),
  "detail": [
    { "name": "食材名", "amount": "用量", "calories": 数字, "protein": 数字, "fat": 数字, "carbs": 数字 }
  ]
}`;

    console.log(`[Nutrition] Analyzing recipe: ${recipe.name} (${recipeId})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(arkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业营养师，精通中式菜品的营养分析。只输出JSON，不要任何额外文字。",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        thinking: { type: "disabled" },
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Nutrition] LLM error (${response.status}):`, errText);
      res.status(500).json({ error: "AI 营养分析失败" });
      return;
    }

    const data = await response.json();
    let jsonStr = data.choices?.[0]?.message?.content?.trim() || "";

    // 去掉可能的 markdown 包裹
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const nutrition = JSON.parse(jsonStr);
    console.log(
      `[Nutrition] Result: ${nutrition.calories} kcal, P:${nutrition.protein}g F:${nutrition.fat}g C:${nutrition.carbs}g`
    );

    // 5. 持久化到数据库
    const { error: insertErr } = await supabase
      .from("recipe_nutrition")
      .upsert(
        {
          recipe_id: recipeId,
          calories: nutrition.calories,
          protein: nutrition.protein,
          fat: nutrition.fat,
          carbs: nutrition.carbs,
          fiber: nutrition.fiber || 0,
          sodium: nutrition.sodium || 0,
          sugar: nutrition.sugar || 0,
          detail: nutrition.detail || [],
          source: "ai",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "recipe_id" }
      );

    if (insertErr) {
      console.error("[Nutrition] DB insert error:", insertErr.message);
    }

    res.json({
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      fiber: nutrition.fiber || 0,
      sodium: nutrition.sodium || 0,
      sugar: nutrition.sugar || 0,
      detail: nutrition.detail || [],
      source: "ai",
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[Nutrition] Analysis timeout");
      res.status(504).json({ error: "营养分析超时，请重试" });
    } else {
      console.error("[Nutrition] Analysis error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── GET /api/nutrition/:recipeId ─── 获取已缓存的营养数据
router.get("/:recipeId", async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.params;

    const { data, error } = await supabase
      .from("recipe_nutrition")
      .select("*")
      .eq("recipe_id", recipeId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "未找到营养数据，请先分析" });
      return;
    }

    res.json(formatNutrition(data));
  } catch (err: any) {
    console.error("GET /api/nutrition error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nutrition/daily/stats ─── 每日营养统计（基于用餐计划）
router.get("/daily/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // 1. 获取用户的用餐计划
    const { data: plans, error: planErr } = await supabase
      .from("meal_plans")
      .select("recipe_id")
      .eq("user_id", userId);

    if (planErr) throw planErr;
    if (!plans || plans.length === 0) {
      res.json({
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        totalFiber: 0,
        totalSodium: 0,
        totalSugar: 0,
        recipeCount: 0,
        recipes: [],
      });
      return;
    }

    const recipeIds = plans.map((p: any) => p.recipe_id);

    // 2. 获取这些菜谱的营养数据
    const { data: nutritionList, error: nutErr } = await supabase
      .from("recipe_nutrition")
      .select("recipe_id, calories, protein, fat, carbs, fiber, sodium, sugar")
      .in("recipe_id", recipeIds);

    if (nutErr) throw nutErr;

    // 3. 获取菜谱名称
    const { data: recipeNames } = await supabase
      .from("recipes")
      .select("id, name, image")
      .in("id", recipeIds);

    const nameMap = new Map(
      (recipeNames || []).map((r: any) => [r.id, { name: r.name, image: r.image }])
    );

    // 4. 汇总
    let totalCalories = 0,
      totalProtein = 0,
      totalFat = 0,
      totalCarbs = 0,
      totalFiber = 0,
      totalSodium = 0,
      totalSugar = 0;

    const recipes = (nutritionList || []).map((n: any) => {
      totalCalories += Number(n.calories) || 0;
      totalProtein += Number(n.protein) || 0;
      totalFat += Number(n.fat) || 0;
      totalCarbs += Number(n.carbs) || 0;
      totalFiber += Number(n.fiber) || 0;
      totalSodium += Number(n.sodium) || 0;
      totalSugar += Number(n.sugar) || 0;

      const info = nameMap.get(n.recipe_id);
      return {
        recipeId: n.recipe_id,
        name: info?.name || "未知菜品",
        image: info?.image || "",
        calories: Number(n.calories) || 0,
        protein: Number(n.protein) || 0,
        fat: Number(n.fat) || 0,
        carbs: Number(n.carbs) || 0,
        fiber: Number(n.fiber) || 0,
        sodium: Number(n.sodium) || 0,
      };
    });

    // 未分析的菜谱
    const analyzedIds = new Set((nutritionList || []).map((n: any) => n.recipe_id));
    const unanalyzed = recipeIds
      .filter((id: string) => !analyzedIds.has(id))
      .map((id: string) => {
        const info = nameMap.get(id);
        return {
          recipeId: id,
          name: info?.name || "未知菜品",
          image: info?.image || "",
          needsAnalysis: true,
        };
      });

    res.json({
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein),
      totalFat: Math.round(totalFat),
      totalCarbs: Math.round(totalCarbs),
      totalFiber: Math.round(totalFiber),
      totalSodium: Math.round(totalSodium),
      totalSugar: Math.round(totalSugar),
      recipeCount: plans.length,
      analyzedCount: (nutritionList || []).length,
      recipes,
      unanalyzed,
    });
  } catch (err: any) {
    console.error("GET /api/nutrition/daily/stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 格式化数据库行 → 前端格式
function formatNutrition(row: any) {
  return {
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    fat: Number(row.fat) || 0,
    carbs: Number(row.carbs) || 0,
    fiber: Number(row.fiber) || 0,
    sodium: Number(row.sodium) || 0,
    sugar: Number(row.sugar) || 0,
    detail: row.detail || [],
    source: row.source || "ai",
  };
}

export default router;
