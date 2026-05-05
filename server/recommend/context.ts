// ─────────────────────────────────────────────
// 用户上下文加载 + 跨切面硬筛
// ─────────────────────────────────────────────

import { supabase } from "../supabase.js";
import type { UserContext, RequestFilters, RecommendInput } from "./types.js";
import { getSceneTags, getTasteTags, getMaxMinutes, parseMinutes } from "./shared.js";

// 加载用户上下文 + 全菜谱（供推荐链路使用）
export async function loadUserContext(userId: string): Promise<{
  ctx: UserContext;
  allRecipes: any[];
}> {
  const [
    { data: ingredients },
    { data: profile },
    { data: allRecipes },
  ] = await Promise.all([
    supabase
      .from("ingredients")
      .select("name, amount, category, expiry_days")
      .eq("user_id", userId)
      .order("expiry_days", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("restrictions, taste_preferences")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("recipes")
      .select("*")
      .not("id", "like", "ai_%")
      .order("created_at", { ascending: false }),
  ]);

  const validIngredients = (ingredients || []).filter(
    (i: any) => (i.expiry_days || 0) > 0
  );
  const inventoryNames = validIngredients.map((i: any) => i.name);

  // 创建临期权重表：越快过期，权重越高
  const expiryWeights: Record<string, number> = {};
  for (const ing of (ingredients || [])) {
    const days = ing.expiry_days || 999;
    expiryWeights[ing.name] = days <= 3 ? 5 : days <= 7 ? 3 : days <= 14 ? 2 : 1;
  }

  const ctx: UserContext = {
    userId,
    ingredients: ingredients || [],
    validIngredients,
    inventoryNames,
    expiryWeights,
    restrictions: profile?.restrictions || [],
    savedTastes: profile?.taste_preferences || [],
  };

  return { ctx, allRecipes: allRecipes || [] };
}

// 加载首页推荐用上下文（额外需要历史和收藏）
export async function loadHomePicksContext(userId: string): Promise<{
  ctx: UserContext;
  allRecipes: any[];
  historyData: any[];
  favoritesData: any[];
}> {
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
      .eq("user_id", userId)
      .order("expiry_days", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("restrictions, taste_preferences")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("recipes")
      .select("*")
      .not("id", "like", "ai_%")
      .order("created_at", { ascending: false }),
    supabase
      .from("history")
      .select("recipe_id, recipes(tags)")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(50),
    supabase
      .from("favorites")
      .select("recipe_id, recipes(tags)")
      .eq("user_id", userId)
      .limit(50),
  ]);

  const validIngredients = (ingredients || []).filter(
    (i: any) => (i.expiry_days || 0) > 0
  );
  const inventoryNames = validIngredients.map((i: any) => i.name);

  const expiryWeights: Record<string, number> = {};
  for (const ing of (ingredients || [])) {
    const days = ing.expiry_days || 999;
    expiryWeights[ing.name] = days <= 3 ? 5 : days <= 7 ? 3 : days <= 14 ? 2 : 1;
  }

  const ctx: UserContext = {
    userId,
    ingredients: ingredients || [],
    validIngredients,
    inventoryNames,
    expiryWeights,
    restrictions: profile?.restrictions || [],
    savedTastes: profile?.taste_preferences || [],
  };

  return {
    ctx,
    allRecipes: allRecipes || [],
    historyData: historyData || [],
    favoritesData: favoritesData || [],
  };
}

// 解析请求参数为 RequestFilters
export function buildFilters(input: RecommendInput): RequestFilters {
  const sceneTags = getSceneTags(input.mealType || "正餐");
  const tasteTags = getTasteTags(input.tastePreference || "");
  const combinedTags = [...new Set([...sceneTags, ...tasteTags.boost])];

  return {
    sceneTags,
    combinedTags,
    maxMinutes: getMaxMinutes(input.prepTime || "30分钟内"),
    tasteTags,
    useInventory: input.useInventory !== false,
    mealType: input.mealType || "正餐",
    prepTime: input.prepTime || "30分钟内",
    peopleCount: input.peopleCount || "2人",
    tastePreference: input.tastePreference || "",
  };
}

// 跨切面硬筛：时间上限 + 忌口（推荐链路第一道闸）
export function applyHardFilters(
  recipes: any[],
  ctx: UserContext,
  filters: RequestFilters
): any[] {
  return recipes
    .filter((r: any) => parseMinutes(r.time || "30分钟") <= filters.maxMinutes)
    .filter((r: any) => {
      if (ctx.restrictions.length === 0) return true;
      const recipeName = r.name || "";
      const recipeDesc = r.description || "";
      return !ctx.restrictions.some((ban: string) =>
        recipeName.includes(ban) || recipeDesc.includes(ban)
      );
    });
}

// 仅过滤忌口（home-picks 用，不限时间）
export function applyRestrictionFilter(recipes: any[], ctx: UserContext): any[] {
  return recipes.filter((r: any) => {
    if (ctx.restrictions.length === 0) return true;
    const text = `${r.name || ""} ${r.description || ""}`;
    return !ctx.restrictions.some((ban: string) => text.includes(ban));
  });
}
