// ─────────────────────────────────────────────
// 时段召回：基于当前小时数选择对应的标签集合
// 主要服务于 home-picks slot2（早餐/午餐/下午茶/晚餐/宵夜）
// ─────────────────────────────────────────────

import type { RecallChannel, RecallResult, UserContext } from "../types.js";
import { getTasteTags } from "../shared.js";

// 工厂：基于时段标签构造 channel
export function createTimeSlotChannel(timeTags: string[]): RecallChannel {
  return {
    name: "timeslot",
    run(recipes: any[], ctx: UserContext): RecallResult {
      const result: RecallResult = new Map();
      const tastePrefs = ctx.savedTastes;

      for (const r of recipes) {
        const tags: string[] = r.tags || [];
        let score = 0;
        for (const tag of tags) {
          if (timeTags.includes(tag)) score += 3;
        }
        // 口味偏好微调
        for (const taste of tastePrefs) {
          const tt = getTasteTags(taste);
          for (const tag of tags) {
            if (tt.boost.includes(tag)) score += 2;
            if (tt.penalize.includes(tag)) score -= 3;
          }
        }
        if (score > 0) {
          result.set(r.id, { score });
        }
      }
      return result;
    },
  };
}
