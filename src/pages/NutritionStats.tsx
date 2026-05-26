import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { api } from "../api/client";
import { cn } from "../lib/utils";

interface RecipeNutrition {
  recipeId: string;
  name: string;
  image: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  needsAnalysis?: boolean;
}

interface DailyStats {
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
  totalSodium: number;
  totalSugar: number;
  recipeCount: number;
  analyzedCount: number;
  recipes: RecipeNutrition[];
  unanalyzed: RecipeNutrition[];
}

// 推荐日摄入量
const DRI = {
  calories: 2000,
  protein: 65,
  fat: 65,
  carbs: 300,
  fiber: 25,
  sodium: 2000,
  sugar: 50,
};

const MACRO_COLORS = {
  protein: { main: "#6366f1", bg: "bg-indigo-50", text: "text-indigo-600" },
  fat: { main: "#f59e0b", bg: "bg-amber-50", text: "text-amber-600" },
  carbs: { main: "#10b981", bg: "bg-emerald-50", text: "text-emerald-600" },
};

export default function NutritionStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.get<DailyStats>("/nutrition/daily/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load nutrition stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeRecipe = async (recipeId: string) => {
    setAnalyzing(recipeId);
    try {
      await api.post(`/nutrition/analyze/${recipeId}`, {});
      await loadStats();
    } catch (err) {
      console.error("Failed to analyze recipe:", err);
    } finally {
      setAnalyzing(null);
    }
  };

  const analyzeAll = async () => {
    if (!stats?.unanalyzed?.length) return;
    for (const recipe of stats.unanalyzed) {
      setAnalyzing(recipe.recipeId);
      try {
        await api.post(`/nutrition/analyze/${recipe.recipeId}`, {});
      } catch {}
    }
    setAnalyzing(null);
    await loadStats();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface max-w-md mx-auto flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-medium">加载营养数据...</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.recipeCount === 0) {
    return (
      <div className="px-6 pt-8 pb-8">
        <h1 className="text-2xl font-black text-zinc-900 mb-1">营养统计</h1>
        <p className="text-zinc-400 text-xs font-medium mb-12">基于用餐计划的营养分析</p>
        <div className="flex flex-col items-center justify-center pt-12">
          <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
            <Flame size={32} className="text-zinc-300" />
          </div>
          <p className="text-zinc-400 text-center text-sm leading-relaxed">
            你的用餐计划还是空的
            <br />
            添加菜品到计划后，这里会显示营养统计
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-6 py-3 bg-primary text-white text-sm font-bold rounded-full shadow-md shadow-primary/20 active:scale-95 transition-transform"
          >
            去挑菜品
          </button>
        </div>
      </div>
    );
  }

  const caloriesPct = Math.min(
    Math.round((stats.totalCalories / DRI.calories) * 100),
    150
  );
  const caloriesDisplayPct = Math.min(caloriesPct, 100);

  // 宏量营养素圆环数据
  const proteinCal = stats.totalProtein * 4;
  const fatCal = stats.totalFat * 9;
  const carbsCal = stats.totalCarbs * 4;
  const totalMacroCal = proteinCal + fatCal + carbsCal || 1;
  const proteinPct = Math.round((proteinCal / totalMacroCal) * 100);
  const fatPct = Math.round((fatCal / totalMacroCal) * 100);
  const carbsPct = 100 - proteinPct - fatPct;

  const conicGradient = `conic-gradient(
    ${MACRO_COLORS.protein.main} 0deg ${proteinPct * 3.6}deg,
    ${MACRO_COLORS.fat.main} ${proteinPct * 3.6}deg ${(proteinPct + fatPct) * 3.6}deg,
    ${MACRO_COLORS.carbs.main} ${(proteinPct + fatPct) * 3.6}deg 360deg
  )`;

  return (
    <div className="animate-in fade-in duration-500 pb-8">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-black text-zinc-900 mb-1">营养统计</h1>
        <p className="text-[10px] text-zinc-400 font-medium">
          基于用餐计划 · {stats.recipeCount} 道菜品
        </p>
      </div>

      <main className="px-6 space-y-6">
        {/* 热量总览卡 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-50 to-amber-50/80 p-6 rounded-3xl border border-orange-100/80 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Flame size={16} className="text-orange-500" />
              </div>
              <span className="text-sm font-bold text-zinc-800">
                今日热量摄入
              </span>
            </div>
            <span className="text-[10px] font-medium text-zinc-400 bg-white/70 px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={10} />
              AI 估算
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* 环形图 */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: conicGradient,
                  mask: "radial-gradient(farthest-side, transparent 60%, black 61%)",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent 60%, black 61%)",
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-zinc-900 leading-none">
                  {stats.totalCalories}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold mt-1">
                  / {DRI.calories} kcal
                </span>
              </div>
            </div>

            {/* 宏量营养素 */}
            <div className="flex-1 space-y-3">
              {[
                {
                  key: "protein",
                  label: "蛋白质",
                  value: stats.totalProtein,
                  dri: DRI.protein,
                  pct: proteinPct,
                },
                {
                  key: "fat",
                  label: "脂肪",
                  value: stats.totalFat,
                  dri: DRI.fat,
                  pct: fatPct,
                },
                {
                  key: "carbs",
                  label: "碳水",
                  value: stats.totalCarbs,
                  dri: DRI.carbs,
                  pct: carbsPct,
                },
              ].map((macro) => {
                const colors =
                  MACRO_COLORS[macro.key as keyof typeof MACRO_COLORS];
                const driPct = Math.min(
                  Math.round((macro.value / macro.dri) * 100),
                  100
                );
                return (
                  <div key={macro.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colors.main }}
                        />
                        <span className="text-xs text-zinc-500 font-medium">
                          {macro.label}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-zinc-700">
                        {macro.value}g
                        <span className="text-zinc-400 font-normal ml-1">
                          / {macro.dri}g
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${driPct}%` }}
                        transition={{
                          duration: 0.8,
                          ease: "easeOut",
                          delay: 0.2,
                        }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: colors.main }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 热量进度条 */}
          <div className="mt-5 bg-white/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 font-medium">
                日推荐热量进度
              </span>
              <span
                className={cn(
                  "text-sm font-black",
                  caloriesPct > 100 ? "text-red-500" : "text-orange-500"
                )}
              >
                {caloriesPct}%
              </span>
            </div>
            <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${caloriesDisplayPct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  caloriesPct > 100
                    ? "bg-gradient-to-r from-red-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-amber-400"
                )}
              />
            </div>
          </div>
        </motion.div>

        {/* 微量营养素卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            {
              label: "膳食纤维",
              value: stats.totalFiber,
              unit: "g",
              dri: DRI.fiber,
              icon: "🥦",
              gradient: "from-green-50 to-emerald-50",
              border: "border-green-100",
            },
            {
              label: "钠",
              value: stats.totalSodium,
              unit: "mg",
              dri: DRI.sodium,
              icon: "🧂",
              gradient: "from-blue-50 to-sky-50",
              border: "border-blue-100",
            },
            {
              label: "糖",
              value: stats.totalSugar,
              unit: "g",
              dri: DRI.sugar,
              icon: "🍬",
              gradient: "from-pink-50 to-rose-50",
              border: "border-pink-100",
            },
          ].map((item) => {
            const pct = Math.min(
              Math.round((item.value / item.dri) * 100),
              100
            );
            return (
              <div
                key={item.label}
                className={cn(
                  "bg-gradient-to-br p-4 rounded-2xl border",
                  item.gradient,
                  item.border
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <p className="text-[10px] text-zinc-400 font-bold mt-2 mb-1">
                  {item.label}
                </p>
                <p className="text-lg font-black text-zinc-800">
                  {item.value}
                  <span className="text-xs font-medium text-zinc-400 ml-0.5">
                    {item.unit}
                  </span>
                </p>
                <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="h-full rounded-full bg-zinc-400/40"
                  />
                </div>
                <p className="text-[9px] text-zinc-400 mt-1 text-right">
                  {pct}% DRI
                </p>
              </div>
            );
          })}
        </motion.div>

        {/* 菜品营养列表 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold text-zinc-900 mb-4">
            菜品营养明细
          </h2>
          <div className="space-y-3">
            {stats.recipes.map((recipe, i) => (
              <motion.div
                key={recipe.recipeId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => navigate(`/recipe/${recipe.recipeId}`)}
                className="flex items-center gap-4 bg-zinc-50/80 p-4 rounded-2xl border border-zinc-100 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <img
                  src={recipe.image}
                  alt={recipe.name}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 truncate">
                    {recipe.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-orange-500 font-bold">
                      {recipe.calories} kcal
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      蛋白{recipe.protein}g · 脂肪{recipe.fat}g · 碳水
                      {recipe.carbs}g
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-zinc-300" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 未分析的菜品 */}
        {stats.unanalyzed && stats.unanalyzed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold text-zinc-700">
                  待分析 ({stats.unanalyzed.length})
                </h2>
              </div>
              <button
                onClick={analyzeAll}
                disabled={!!analyzing}
                className="text-xs font-bold text-primary bg-primary/5 px-4 py-2 rounded-full active:scale-95 transition-transform disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    分析中...
                  </span>
                ) : (
                  "全部分析"
                )}
              </button>
            </div>
            <div className="space-y-2">
              {stats.unanalyzed.map((recipe) => (
                <div
                  key={recipe.recipeId}
                  className="flex items-center gap-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100/80"
                >
                  <img
                    src={recipe.image}
                    alt={recipe.name}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 opacity-80"
                    referrerPolicy="no-referrer"
                  />
                  <p className="flex-1 text-sm font-medium text-zinc-600 truncate">
                    {recipe.name}
                  </p>
                  <button
                    onClick={() => analyzeRecipe(recipe.recipeId)}
                    disabled={analyzing === recipe.recipeId}
                    className="text-[11px] font-bold text-primary bg-white px-4 py-2 rounded-full shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {analyzing === recipe.recipeId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "分析"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
