// ─────────────────────────────────────────────
// 推荐链路共享类型
// 召回 → 排序 → 重排
// ─────────────────────────────────────────────

export interface RecommendInput {
  userId: string;
  peopleCount?: string;
  prepTime?: string;
  mealType?: string;
  tastePreference?: string;
  useInventory?: boolean;
}

export interface UserContext {
  userId: string;
  ingredients: any[];           // 全部食材（含已过期）
  validIngredients: any[];      // 未过期食材
  inventoryNames: string[];     // 未过期食材名
  expiryWeights: Record<string, number>;  // 食材名 → 临期权重
  restrictions: string[];
  savedTastes: string[];
}

export interface RequestFilters {
  sceneTags: string[];          // 场景对应的标签
  combinedTags: string[];       // 场景 + 口味 boost 合并
  maxMinutes: number;           // 烹饪时间上限
  tasteTags: { boost: string[]; penalize: string[] };
  useInventory: boolean;
  mealType: string;
  prepTime: string;
  peopleCount: string;
  tastePreference: string;
}

// 单路召回的输出：稀疏 signal 表
export interface RecallSignal {
  score: number;                // 该路给出的分数
  meta?: Record<string, any>;   // 该路的辅助字段（如命中数）
}

export type RecallResult = Map<string, RecallSignal>;  // recipeId → signal

export interface RecallChannel {
  name: string;
  run(recipes: any[], ctx: UserContext, filters: RequestFilters): RecallResult;
}

// 排序阶段：合并所有 channel signals 后的菜品
export interface ScoredRecipe {
  recipe: any;                  // 原始 recipe row
  totalScore: number;
  signals: Record<string, number>;        // channelName → score
  recallSources: string[];                // 命中的 channel 名
  sceneTagHits: number;
  combinedTagHits: number;
  inventoryMatched: number;
}

// 最终输出格式（与前端契约一致）
export interface FinalRecipe {
  id: string;
  name: string;
  description: string;
  image: string;
  tags: string[];
  time: string;
  difficulty: string;
  calories: string;
  recommendationReason: string;
  matchPercentage: number;
  inventoryMatch: number;
  ingredients: { have: any[]; missing: any[] };
  steps: string[];
  slot?: string;                // homePicks 专用
  hint?: string;                // homePicks 专用
}
