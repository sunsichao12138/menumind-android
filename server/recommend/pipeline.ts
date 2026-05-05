// ─────────────────────────────────────────────
// /recommend 主编排：召回 → 排序 → AI 重排
// ─────────────────────────────────────────────

import { supabase } from "../supabase.js";
import type { RecommendInput, FinalRecipe } from "./types.js";
import { buildRecommendReason } from "./shared.js";
import { loadUserContext, buildFilters, applyHardFilters } from "./context.js";
import {
  runRecall,
  sceneChannel,
  tasteChannel,
  inventoryChannel,
} from "./recall/index.js";
import { mergeAndRank } from "./ranking.js";
import { llmRerank, fullGeneration, loadLlmConfig } from "./rerank.js";
import { formatFinalRecipe } from "./format.js";

const TOP_N = 20;
const FINAL_LIMIT = 10;
const AI_PICK = 5;

export async function runRecommend(input: RecommendInput): Promise<FinalRecipe[]> {
  const llm = loadLlmConfig();
  if (!llm) {
    throw new Error("ARK_API_KEY not configured in .env.local");
  }

  const t0 = Date.now();

  // ── Step 1: 加载上下文 + 解析筛选条件 ──
  const { ctx, allRecipes } = await loadUserContext(input.userId);
  const filters = buildFilters(input);

  const t1 = Date.now();
  console.log(`[Pipeline][Perf] DB queries: ${t1 - t0}ms`);

  // ── Step 2: 跨切面硬筛（时间 + 忌口）──
  const universe = applyHardFilters(allRecipes, ctx, filters);

  // ── Step 3: 多路召回 → 合并 signals ──
  const merged = runRecall(universe, ctx, filters, [
    sceneChannel,
    tasteChannel,
    inventoryChannel,
  ]);

  // ── Step 4: 排序（含场景标签硬筛兜底）→ Top-N ──
  const ranked = mergeAndRank(universe, merged, {
    topN: TOP_N,
    enforceSceneFilter: true,
  });

  console.log(
    `[Pipeline] Stage 1: Filtered ${ranked.topCandidates.length} candidates from ${allRecipes.length} total recipes`
  );
  console.log(
    `[Pipeline] Top: ${ranked.topCandidates
      .slice(0, 5)
      .map(
        (s) =>
          `${s.recipe.name}(score=${s.totalScore},inv=${s.inventoryMatched},taste=${s.signals.taste || 0})`
      )
      .join(", ")}`
  );

  const t2 = Date.now();
  console.log(`[Pipeline][Perf] Stage 1 scoring + filtering: ${t2 - t1}ms`);

  // ── Step 5: 候选不足或场景完全不匹配 → fullGeneration 兜底 ──
  if (ranked.topCandidates.length < 3 || ranked.bestSceneTagHits === 0) {
    console.log(
      `[Pipeline] Falling back to full generation (candidates=${ranked.topCandidates.length}, bestSceneTagHits=${ranked.bestSceneTagHits})`
    );
    return await fullGeneration(ctx, filters, llm);
  }

  // ── Step 6: LLM 重排 ──
  const aiSelections = await llmRerank(ranked.topCandidates, ctx, filters, llm);

  const t3 = Date.now();
  console.log(`[Pipeline][Perf] Stage 2 AI call: ${t3 - t2}ms`);

  // ── Step 7a: AI 失败 → 用 Stage 1 排序直接返回前 10 + 模板理由 ──
  if (!aiSelections || aiSelections.length === 0) {
    const fallback = ranked.topCandidates.slice(0, FINAL_LIMIT).map((s) => {
      const r = s.recipe;
      const haveNames = filters.useInventory
        ? r.ingredients_have
            ?.filter((ing: any) => ctx.inventoryNames.includes(ing.name))
            .map((ing: any) => ing.name) || []
        : [];
      const reason = buildRecommendReason(
        r.name,
        r.description || "",
        haveNames,
        r.tags || []
      );
      return formatFinalRecipe({
        recipe: r,
        inventoryNames: ctx.inventoryNames,
        recommendationReason: reason,
      });
    });
    console.log(`[Pipeline] Returned ${fallback.length} from Stage 1 fallback`);
    return fallback;
  }

  // ── Step 7b: AI 成功 → 拼装最终结果 ──
  const savedRecipes: FinalRecipe[] = [];
  for (const sel of aiSelections.slice(0, AI_PICK)) {
    const idx = (sel.index || 1) - 1;
    const candidate = ranked.topCandidates[idx];
    if (!candidate) continue;

    const r = candidate.recipe;
    const final = formatFinalRecipe({
      recipe: r,
      inventoryNames: ctx.inventoryNames,
      recommendationReason:
        sel.reason || (r as any).recommendationReason || r.recommendation_reason || "",
    });

    // 只更新 AI 生成的菜谱（id 以 ai_ 开头），不污染种子菜谱
    if (r.id?.startsWith("ai_")) {
      await supabase
        .from("recipes")
        .update({
          recommendation_reason: final.recommendationReason,
          match_percentage: final.matchPercentage,
          inventory_match: final.inventoryMatch,
          ingredients_have: final.ingredients.have,
          ingredients_missing: final.ingredients.missing,
        })
        .eq("id", r.id);
    }
    savedRecipes.push(final);
  }

  // ── Step 8: 用 Stage 1 剩余候选填充到 FINAL_LIMIT ──
  const usedIds = new Set(savedRecipes.map((r) => r.id));
  for (const candidate of ranked.topCandidates) {
    if (savedRecipes.length >= FINAL_LIMIT) break;
    if (usedIds.has(candidate.recipe.id)) continue;
    const r = candidate.recipe;
    // 重新分类 have 用于生成模板理由
    const haveNames = (r.ingredients_have || [])
      .filter((ing: any) => ctx.inventoryNames.includes(ing.name))
      .map((ing: any) => ing.name);
    const reason = buildRecommendReason(
      r.name,
      r.description || "",
      haveNames,
      r.tags || []
    );
    savedRecipes.push(
      formatFinalRecipe({
        recipe: r,
        inventoryNames: ctx.inventoryNames,
        recommendationReason: reason,
      })
    );
  }

  const t4 = Date.now();
  console.log(`[Pipeline][Perf] Result assembly: ${t4 - t3}ms`);
  console.log(`[Pipeline][Perf] ══ TOTAL: ${t4 - t0}ms ══`);
  console.log(`[Pipeline] Successfully recommended ${savedRecipes.length} recipes`);
  return savedRecipes;
}
