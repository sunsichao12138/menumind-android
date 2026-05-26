import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Loader2, ChevronDown, Sparkles, Zap, Droplets, Wheat, Leaf } from "lucide-react";
import { api } from "../api/client";
import { NutritionInfo } from "../types";
import { cn } from "../lib/utils";

interface NutritionCardProps {
  recipeId: string;
}

// 推荐日摄入量 (DRI) 参考值
const DRI = {
  calories: 2000,
  protein: 65,
  fat: 65,
  carbs: 300,
  fiber: 25,
  sodium: 2000,
  sugar: 50,
};

// 宏量营养素颜色
const MACRO_COLORS = {
  protein: { main: "#6366f1", light: "#e0e7ff", label: "蛋白质" },
  fat: { main: "#f59e0b", light: "#fef3c7", label: "脂肪" },
  carbs: { main: "#10b981", light: "#d1fae5", label: "碳水" },
};

export default function NutritionCard({ recipeId }: NutritionCardProps) {
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadNutrition();
  }, [recipeId]);

  const loadNutrition = async () => {
    setLoading(true);
    setError("");
    try {
      // 先尝试获取缓存
      const data = await api.get<NutritionInfo>(`/nutrition/${recipeId}`);
      setNutrition(data);
    } catch {
      // 没有缓存，自动触发分析
      await analyzeNutrition();
    } finally {
      setLoading(false);
    }
  };

  const analyzeNutrition = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const data = await api.post<NutritionInfo>(
        `/nutrition/analyze/${recipeId}`,
        {}
      );
      setNutrition(data);
    } catch (err: any) {
      setError(err.message || "营养分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  // 骨架屏
  if (loading || analyzing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-3xl border border-orange-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Loader2 size={16} className="text-primary animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-700">
                {analyzing ? "AI 正在分析营养成分..." : "加载中..."}
              </p>
              <p className="text-[10px] text-zinc-400">
                基于食材清单智能估算
              </p>
            </div>
          </div>
          {/* shimmer skeleton */}
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-28 h-28 rounded-full bg-white/60 animate-pulse" />
              <div className="flex-1 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-4 bg-white/60 rounded-full animate-pulse"
                    style={{ width: `${90 - i * 15}%`, animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-3 bg-white/40 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 p-6 rounded-3xl border border-red-100 text-center"
      >
        <p className="text-red-500 text-sm font-medium mb-3">{error}</p>
        <button
          onClick={analyzeNutrition}
          className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-full shadow-md shadow-primary/20 active:scale-95 transition-transform"
        >
          重新分析
        </button>
      </motion.div>
    );
  }

  if (!nutrition) return null;

  // 计算宏量营养素比例（按热量贡献）
  const proteinCal = nutrition.protein * 4;
  const fatCal = nutrition.fat * 9;
  const carbsCal = nutrition.carbs * 4;
  const totalMacroCal = proteinCal + fatCal + carbsCal || 1;

  const proteinPct = Math.round((proteinCal / totalMacroCal) * 100);
  const fatPct = Math.round((fatCal / totalMacroCal) * 100);
  const carbsPct = 100 - proteinPct - fatPct;

  // 环形图 conic-gradient
  const conicGradient = `conic-gradient(
    ${MACRO_COLORS.protein.main} 0deg ${proteinPct * 3.6}deg,
    ${MACRO_COLORS.fat.main} ${proteinPct * 3.6}deg ${(proteinPct + fatPct) * 3.6}deg,
    ${MACRO_COLORS.carbs.main} ${(proteinPct + fatPct) * 3.6}deg 360deg
  )`;

  // 微量营养素进度条数据
  const microNutrients = [
    {
      label: "膳食纤维",
      value: nutrition.fiber,
      unit: "g",
      dri: DRI.fiber,
      icon: Leaf,
      color: "#22c55e",
    },
    {
      label: "钠",
      value: nutrition.sodium,
      unit: "mg",
      dri: DRI.sodium,
      icon: Droplets,
      color: "#3b82f6",
    },
    {
      label: "糖",
      value: nutrition.sugar,
      unit: "g",
      dri: DRI.sugar,
      icon: Zap,
      color: "#f97316",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* 主卡片 */}
      <div className="bg-gradient-to-br from-orange-50/80 to-amber-50/60 p-6 rounded-3xl border border-orange-100/80 shadow-sm">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Flame size={16} className="text-orange-500" />
            </div>
            <span className="text-sm font-bold text-zinc-800">营养成分</span>
          </div>
          <span className="text-[10px] font-medium text-zinc-400 bg-white/70 px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles size={10} />
            AI 估算
          </span>
        </div>

        {/* 宏量营养素 - 环形图 + 数值 */}
        <div className="flex items-center gap-6 mb-6">
          {/* 环形图 */}
          <div className="relative w-28 h-28 flex-shrink-0">
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
              <span className="text-2xl font-black text-zinc-900 leading-none">
                {nutrition.calories}
              </span>
              <span className="text-[10px] text-zinc-400 font-bold mt-0.5">
                kcal
              </span>
            </div>
          </div>

          {/* 数值列表 */}
          <div className="flex-1 space-y-3">
            {Object.entries(MACRO_COLORS).map(([key, conf]) => {
              const value =
                key === "protein"
                  ? nutrition.protein
                  : key === "fat"
                  ? nutrition.fat
                  : nutrition.carbs;
              const pct =
                key === "protein"
                  ? proteinPct
                  : key === "fat"
                  ? fatPct
                  : carbsPct;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: conf.main }}
                  />
                  <span className="text-xs text-zinc-500 w-10 font-medium">
                    {conf.label}
                  </span>
                  <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: conf.main }}
                    />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 w-12 text-right">
                    {value}g
                  </span>
                  <span className="text-[10px] text-zinc-400 w-8 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 微量营养素进度条 */}
        <div className="bg-white/50 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
            每日推荐摄入占比
          </p>
          {microNutrients.map((nutrient) => {
            const pct = Math.min(
              Math.round((nutrient.value / nutrient.dri) * 100),
              100
            );
            const Icon = nutrient.icon;
            return (
              <div key={nutrient.label} className="flex items-center gap-3">
                <Icon
                  size={14}
                  className="flex-shrink-0"
                  style={{ color: nutrient.color }}
                />
                <span className="text-xs text-zinc-500 w-14 font-medium">
                  {nutrient.label}
                </span>
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: nutrient.color }}
                  />
                </div>
                <span className="text-xs font-bold text-zinc-600 w-20 text-right">
                  {nutrient.value}
                  {nutrient.unit}
                </span>
                <span className="text-[10px] text-zinc-400 w-8 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 食材营养明细（可折叠） */}
      {nutrition.detail && nutrition.detail.length > 0 && (
        <div className="bg-zinc-50/80 rounded-3xl border border-zinc-100 overflow-hidden">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 transition-colors"
          >
            <span className="text-sm font-bold text-zinc-700">
              食材营养明细
            </span>
            <motion.div
              animate={{ rotate: showDetail ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={18} className="text-zinc-400" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showDetail && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-2">
                  {/* 表头 */}
                  <div className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-3 pb-2">
                    <span className="flex-1">食材</span>
                    <span className="w-14 text-right">热量</span>
                    <span className="w-12 text-right">蛋白质</span>
                    <span className="w-12 text-right">脂肪</span>
                    <span className="w-12 text-right">碳水</span>
                  </div>
                  {nutrition.detail.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center bg-white rounded-xl px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {item.amount}
                        </p>
                      </div>
                      <span className="w-14 text-right text-xs font-medium text-zinc-600">
                        {item.calories}
                      </span>
                      <span className="w-12 text-right text-xs text-zinc-500">
                        {item.protein}g
                      </span>
                      <span className="w-12 text-right text-xs text-zinc-500">
                        {item.fat}g
                      </span>
                      <span className="w-12 text-right text-xs text-zinc-500">
                        {item.carbs}g
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
