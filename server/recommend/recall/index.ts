// ─────────────────────────────────────────────
// 召回层入口：并行执行所有 channel，合并 signals
// ─────────────────────────────────────────────

import type {
  RecallChannel,
  RecallResult,
  UserContext,
  RequestFilters,
} from "../types.js";

export { sceneChannel } from "./scene.js";
export { tasteChannel } from "./taste.js";
export { inventoryChannel } from "./inventory.js";
export { expiringChannel } from "./expiring.js";
export { createExplorationChannel } from "./exploration.js";
export { createTimeSlotChannel } from "./timeslot.js";

export interface MergedSignal {
  signals: Record<string, number>;        // channelName → score
  recallSources: string[];                // 命中此菜品的 channel 名
  meta: Record<string, any>;              // 各 channel 的辅助字段（合并）
}

// 并行执行所有 channel，按 recipeId 聚合
export function runRecall(
  recipes: any[],
  ctx: UserContext,
  filters: RequestFilters,
  channels: RecallChannel[]
): Map<string, MergedSignal> {
  const results: Array<{ channel: RecallChannel; output: RecallResult }> = channels.map(
    (channel) => ({ channel, output: channel.run(recipes, ctx, filters) })
  );

  const merged = new Map<string, MergedSignal>();
  for (const { channel, output } of results) {
    for (const [recipeId, signal] of output) {
      let entry = merged.get(recipeId);
      if (!entry) {
        entry = { signals: {}, recallSources: [], meta: {} };
        merged.set(recipeId, entry);
      }
      entry.signals[channel.name] = signal.score;
      entry.recallSources.push(channel.name);
      if (signal.meta) {
        Object.assign(entry.meta, signal.meta);
      }
    }
  }
  return merged;
}
