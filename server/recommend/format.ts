// ─────────────────────────────────────────────
// 输出格式化：把 recipe 行 + 用户库存 → FinalRecipe
// （前端契约：have/missing 用真实库存重新分类）
// ─────────────────────────────────────────────

import { isInInventory } from "../utils/ingredientMatch.js";
import type { FinalRecipe } from "./types.js";

interface FormatOptions {
  recipe: any;
  inventoryNames: string[];
  recommendationReason: string;
  slot?: string;
  hint?: string;
}

// 把一道 recipe 转成前端用的 FinalRecipe（含 have/missing 重新分类）
export function formatFinalRecipe(opts: FormatOptions): FinalRecipe {
  const { recipe: r, inventoryNames, recommendationReason, slot, hint } = opts;
  const allIngs = [
    ...(r.ingredients_have || []),
    ...(r.ingredients_missing || []),
  ];
  const realHave: any[] = [];
  const realMissing: any[] = [];
  for (const ing of allIngs) {
    if (ing.name && isInInventory(ing.name, inventoryNames)) {
      realHave.push(ing);
    } else if (ing.name) {
      realMissing.push(ing);
    }
  }
  const matchPercentage = allIngs.length > 0
    ? Math.round((realHave.length / allIngs.length) * 100)
    : 60;

  return {
    id: r.id,
    name: r.name,
    description: r.description || "",
    image: r.image || "",
    tags: r.tags || [],
    time: r.time || "",
    difficulty: r.difficulty || "",
    calories: r.calories || "",
    recommendationReason,
    matchPercentage,
    inventoryMatch: realHave.length,
    ingredients: { have: realHave, missing: realMissing },
    steps: r.steps || [],
    ...(slot ? { slot } : {}),
    ...(hint ? { hint } : {}),
  };
}

// 把 recipe + 用户库存分成 have/missing 两组（用于 prompt 拼装）
export function splitIngredientsByInventory(
  recipe: any,
  inventoryNames: string[]
): { have: any[]; missing: any[] } {
  const allIngs = [
    ...(recipe.ingredients_have || []),
    ...(recipe.ingredients_missing || []),
  ];
  const have: any[] = [];
  const missing: any[] = [];
  for (const ing of allIngs) {
    if (ing.name && isInInventory(ing.name, inventoryNames)) {
      have.push(ing);
    } else if (ing.name) {
      missing.push(ing);
    }
  }
  return { have, missing };
}
