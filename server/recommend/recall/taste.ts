// ─────────────────────────────────────────────
// 口味偏好召回：标签命中 boost +8 / penalize -10
// ─────────────────────────────────────────────

import type { RecallChannel, RecallResult, UserContext, RequestFilters } from "../types.js";

export const tasteChannel: RecallChannel = {
  name: "taste",
  run(recipes: any[], _ctx: UserContext, filters: RequestFilters): RecallResult {
    const result: RecallResult = new Map();
    const { boost, penalize } = filters.tasteTags;
    if (boost.length === 0 && penalize.length === 0) return result;

    for (const r of recipes) {
      const tags: string[] = r.tags || [];
      let score = 0;
      for (const tag of tags) {
        if (boost.includes(tag)) score += 8;
        if (penalize.includes(tag)) score -= 10;
      }
      if (score !== 0) {
        result.set(r.id, { score });
      }
    }
    return result;
  },
};
