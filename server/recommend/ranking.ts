// ─────────────────────────────────────────────
// 排序层：合并多路 signal → 总分 → 硬筛 → Top-N
// ─────────────────────────────────────────────

import type { ScoredRecipe } from "./types.js";
import type { MergedSignal } from "./recall/index.js";

export interface RankOptions {
  topN: number;                  // 取前 N
  enforceSceneFilter: boolean;   // 是否启用场景标签硬筛
}

export interface RankResult {
  topCandidates: ScoredRecipe[];
  bestSceneTagHits: number;      // 头名的场景命中数（用于判断是否走完整生成兜底）
  totalCandidates: number;       // 全量候选数
}

// 合并 signals → 计算 totalScore → 应用硬筛 → 排序取前 N
export function mergeAndRank(
  recipes: any[],
  merged: Map<string, MergedSignal>,
  opts: RankOptions
): RankResult {
  const scored: ScoredRecipe[] = recipes.map((r: any) => {
    const m = merged.get(r.id);
    const signals = m?.signals || {};
    const meta = m?.meta || {};
    const totalScore = Object.values(signals).reduce((a, b) => a + b, 0);
    return {
      recipe: r,
      totalScore,
      signals,
      recallSources: m?.recallSources || [],
      sceneTagHits: meta.sceneTagHits || 0,
      combinedTagHits: meta.combinedTagHits || 0,
      inventoryMatched: meta.matchedCount || 0,
    };
  });

  // 硬筛：场景标签必须匹配（含口味标签兜底）
  let candidates = scored;
  if (opts.enforceSceneFilter) {
    const sceneMatched = scored.filter((s) => s.sceneTagHits > 0);
    if (sceneMatched.length >= 3) {
      candidates = sceneMatched;
      console.log(`[Rank] Hard scene filter: kept ${candidates.length} scene-matched`);
    } else {
      const tagMatched = scored.filter((s) => s.combinedTagHits > 0);
      if (tagMatched.length >= 3) {
        candidates = tagMatched;
        console.log(
          `[Rank] Hard scene filter: only ${sceneMatched.length} scene-matched, relaxed to ${candidates.length} combined-matched`
        );
      } else {
        console.log(
          `[Rank] Hard scene filter: only ${tagMatched.length} matched, keeping all ${candidates.length}`
        );
      }
    }
  }

  // 排序，取前 N
  candidates.sort((a, b) => b.totalScore - a.totalScore);
  const topCandidates = candidates.slice(0, opts.topN);
  const bestSceneTagHits = topCandidates[0]?.sceneTagHits || 0;

  return {
    topCandidates,
    bestSceneTagHits,
    totalCandidates: candidates.length,
  };
}
