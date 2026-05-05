// ─────────────────────────────────────────────
// /home-picks 编排：3 个 slot，每个 slot 用一路召回
// Slot1 临期消耗 / Slot2 时段适配 / Slot3 探索惊喜
// ─────────────────────────────────────────────

import type { FinalRecipe } from "./types.js";
import { getTimeSlotTags } from "./shared.js";
import { loadHomePicksContext, applyRestrictionFilter } from "./context.js";
import {
  expiringChannel,
  inventoryChannel,
  createTimeSlotChannel,
  createExplorationChannel,
} from "./recall/index.js";
import { formatFinalRecipe } from "./format.js";

export interface HomePicksInput {
  userId: string;
  hour: number;
}

// 给定一路 channel 的输出 Map，按 score 排序后返回首个未被占用的菜
function pickTop(
  result: Map<string, { score: number; meta?: any }>,
  recipes: any[],
  usedIds: Set<string>
): { recipe: any; meta?: any } | null {
  const sorted = [...result.entries()].sort((a, b) => b[1].score - a[1].score);
  for (const [id, signal] of sorted) {
    if (usedIds.has(id)) continue;
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) return { recipe, meta: signal.meta };
  }
  return null;
}

export async function runHomePicks(input: HomePicksInput): Promise<FinalRecipe[]> {
  const t0 = Date.now();
  const { ctx, allRecipes, historyData, favoritesData } = await loadHomePicksContext(
    input.userId
  );
  const t1 = Date.now();
  console.log(`[HomePicks][Perf] DB queries: ${t1 - t0}ms`);

  const safeRecipes = applyRestrictionFilter(allRecipes, ctx);
  const usedIds = new Set<string>();
  const picks: FinalRecipe[] = [];

  // ═══════════════════════════════════
  // Slot 1：临期消耗
  // ═══════════════════════════════════
  let slot1Pick: { recipe: any; meta?: any } | null = null;
  const expiringResult = expiringChannel.run(safeRecipes, ctx, {} as any);
  slot1Pick = pickTop(expiringResult, safeRecipes, usedIds);

  // 兜底：库存匹配度最高（不强制临期）
  if (!slot1Pick) {
    const invResult = inventoryChannel.run(safeRecipes, ctx, {
      useInventory: true,
    } as any);
    slot1Pick = pickTop(invResult, safeRecipes, usedIds);
  }

  if (slot1Pick) {
    const r = slot1Pick.recipe;
    const meta = slot1Pick.meta || {};
    let hint: string;
    if (meta.urgentIngredient) {
      const days = meta.urgentDays;
      hint =
        days <= 1
          ? `冰箱里的${meta.urgentIngredient}今天就要过期了`
          : `冰箱里的${meta.urgentIngredient}还有 ${days} 天过期`;
    } else if (meta.matchedCount > 0) {
      hint = `可以用到冰箱里 ${meta.matchedCount} 种食材`;
    } else {
      hint = "为你精选的今日推荐";
    }
    picks.push(formatFinalRecipe({
      recipe: r,
      inventoryNames: ctx.inventoryNames,
      recommendationReason: hint,
      slot: "expiry",
      hint,
    }));
    usedIds.add(r.id);
  }

  // ═══════════════════════════════════
  // Slot 2：时段适配
  // ═══════════════════════════════════
  const { tags: timeTags, hint: timeHint } = getTimeSlotTags(input.hour);
  const timeChannel = createTimeSlotChannel(timeTags);
  const slot2Result = timeChannel.run(safeRecipes, ctx, {} as any);
  const slot2Pick = pickTop(slot2Result, safeRecipes, usedIds);

  if (slot2Pick) {
    const r = slot2Pick.recipe;
    picks.push(formatFinalRecipe({
      recipe: r,
      inventoryNames: ctx.inventoryNames,
      recommendationReason: timeHint,
      slot: "timeslot",
      hint: timeHint,
    }));
    usedIds.add(r.id);
  }

  // ═══════════════════════════════════
  // Slot 3：探索惊喜
  // ═══════════════════════════════════
  const touchedTags = new Set<string>();
  for (const h of historyData) {
    const tags = (h as any).recipes?.tags;
    if (tags) for (const t of tags) touchedTags.add(t);
  }
  for (const f of favoritesData) {
    const tags = (f as any).recipes?.tags;
    if (tags) for (const t of tags) touchedTags.add(t);
  }
  const touchedRecipeIds = new Set<string>();
  for (const h of historyData) touchedRecipeIds.add((h as any).recipe_id);
  for (const f of favoritesData) touchedRecipeIds.add((f as any).recipe_id);

  const explorationCh = createExplorationChannel(touchedTags, touchedRecipeIds);
  const slot3Result = explorationCh.run(safeRecipes, ctx, {} as any);
  let slot3Pick = pickTop(slot3Result, safeRecipes, usedIds);

  // 兜底：随机一道未浏览过的
  if (!slot3Pick) {
    const unseen = safeRecipes.filter(
      (r: any) => !usedIds.has(r.id) && !touchedRecipeIds.has(r.id)
    );
    if (unseen.length > 0) {
      slot3Pick = { recipe: unseen[Math.floor(Math.random() * unseen.length)] };
    }
  }

  if (slot3Pick) {
    const r = slot3Pick.recipe;
    picks.push(formatFinalRecipe({
      recipe: r,
      inventoryNames: ctx.inventoryNames,
      recommendationReason: "新发现",
      slot: "discovery",
      hint: "新发现",
    }));
    usedIds.add(r.id);
  }

  const t2 = Date.now();
  console.log(
    `[HomePicks][Perf] Logic: ${t2 - t1}ms, TOTAL: ${t2 - t0}ms`
  );
  console.log(
    `[HomePicks] Returned ${picks.length} picks: ${picks
      .map((p) => `${p.slot}:${p.name}`)
      .join(", ")}`
  );

  return picks;
}
