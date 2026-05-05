// ─────────────────────────────────────────────
// 探索召回：用户没接触过的标签 → 给个新发现
// 主要服务于 home-picks slot3
// ─────────────────────────────────────────────

import type { RecallChannel, RecallResult, UserContext } from "../types.js";
import { getTasteTags } from "../shared.js";

// 工厂：闭包持有用户已接触的标签和菜品 ID
export function createExplorationChannel(
  touchedTags: Set<string>,
  touchedRecipeIds: Set<string>
): RecallChannel {
  return {
    name: "exploration",
    run(recipes: any[], ctx: UserContext): RecallResult {
      const result: RecallResult = new Map();
      const tastePrefs = ctx.savedTastes;

      for (const r of recipes) {
        if (touchedRecipeIds.has(r.id)) continue;
        const tags: string[] = r.tags || [];
        const newness = tags.filter((t: string) => !touchedTags.has(t)).length;
        if (newness === 0) continue;

        // 口味兼容性（避免推荐用户讨厌的口味）
        let tasteScore = 0;
        for (const taste of tastePrefs) {
          const tt = getTasteTags(taste);
          for (const tag of tags) {
            if (tt.boost.includes(tag)) tasteScore += 2;
            if (tt.penalize.includes(tag)) tasteScore -= 3;
          }
        }
        if (tasteScore < 0) continue;

        result.set(r.id, {
          score: newness * 2 + tasteScore,
          meta: { newness, tasteScore },
        });
      }
      return result;
    },
  };
}
