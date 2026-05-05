// ─────────────────────────────────────────────
// 临期消耗召回：菜品用到了即将过期的食材
// 主要服务于 home-picks slot1（"冰箱里的 X 还有 N 天过期"）
// ─────────────────────────────────────────────

import { isInInventory, ingredientMatch } from "../../utils/ingredientMatch.js";
import type { RecallChannel, RecallResult, UserContext } from "../types.js";

const URGENT_DAYS = 14;

export const expiringChannel: RecallChannel = {
  name: "expiring",
  run(recipes: any[], ctx: UserContext): RecallResult {
    const result: RecallResult = new Map();
    const urgentIngs = ctx.ingredients.filter(
      (i: any) => (i.expiry_days || 999) <= URGENT_DAYS
    );
    if (urgentIngs.length === 0) return result;

    // 已按 expiry_days 升序排，取最紧迫的食材
    const mostUrgent = urgentIngs[0];

    for (const r of recipes) {
      const allNeeded = [
        ...(r.ingredients_have || []),
        ...(r.ingredients_missing || []),
      ];
      const names = allNeeded.map((i: any) => i.name).filter(Boolean);
      // 必须用到最紧迫的临期食材
      if (!names.some((n: string) => ingredientMatch(mostUrgent.name, n))) continue;

      // 计算总库存匹配数（用作 score，越多越好）
      let matchCount = 0;
      for (const n of names) {
        if (isInInventory(n, ctx.inventoryNames)) matchCount++;
      }
      result.set(r.id, {
        score: matchCount,
        meta: {
          urgentIngredient: mostUrgent.name,
          urgentDays: mostUrgent.expiry_days,
          matchedCount: matchCount,
        },
      });
    }
    return result;
  },
};
