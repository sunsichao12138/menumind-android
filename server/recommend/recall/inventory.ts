// ─────────────────────────────────────────────
// 库存匹配召回：菜品所需食材 ∩ 用户库存
// 含临期权重（3天内 ×5, 7天内 ×3, 14天内 ×2, 其他 ×1）
// ─────────────────────────────────────────────

import { isInInventory, ingredientMatch } from "../../utils/ingredientMatch.js";
import type { RecallChannel, RecallResult, UserContext, RequestFilters } from "../types.js";
import { getRecipeAllIngredients } from "../shared.js";

export const inventoryChannel: RecallChannel = {
  name: "inventory",
  run(recipes: any[], ctx: UserContext, filters: RequestFilters): RecallResult {
    const result: RecallResult = new Map();
    if (!filters.useInventory) return result;
    if (ctx.inventoryNames.length === 0) return result;

    for (const r of recipes) {
      const allNeeded = getRecipeAllIngredients(r, ctx.inventoryNames);
      let score = 0;
      let matched = 0;
      for (const name of allNeeded) {
        if (isInInventory(name, ctx.inventoryNames)) {
          const matchedInv = ctx.inventoryNames.find((inv) => ingredientMatch(inv, name));
          score += (ctx.expiryWeights[matchedInv || name] || 1) * 3;
          matched++;
        }
      }
      if (matched > 0) {
        result.set(r.id, { score, meta: { matchedCount: matched } });
      }
    }
    return result;
  },
};
