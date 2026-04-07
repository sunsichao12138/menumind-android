import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles, Package, Clock, Utensils, Plus, ChevronDown, ChevronUp, Heart, X } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useFavorites } from "../context/FavoritesContext";
import { Recipe } from "../types";
import { api } from "../api/client";

export default function Filters() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQuick = searchParams.get("quick") === "true";
  const initialTag = searchParams.get("tag");
  const { toggleFavorite, isFavorite } = useFavorites();

  // 尝试从缓存恢复上次推荐结果
  const cachedResults = (() => {
    try {
      const raw = localStorage.getItem("ai_recommend_cache");
      if (raw) return JSON.parse(raw) as { recipes: Recipe[]; isAiSource: boolean; filters: any };
    } catch {}
    return null;
  })();

  const [showFilters, setShowFilters] = useState(!isQuick && !cachedResults);
  const [peopleCount, setPeopleCount] = useState(cachedResults?.filters?.peopleCount || "2人");
  const [prepTime, setPrepTime] = useState(cachedResults?.filters?.prepTime || "30分钟内");
  const [mealType, setMealType] = useState(initialTag === "轻食" ? "轻食" : cachedResults?.filters?.mealType || "正餐");
  const [tastePreference, setTastePreference] = useState(cachedResults?.filters?.tastePreference || "咸香");
  const [useInventory, setUseInventory] = useState(cachedResults?.filters?.useInventory ?? true);
  const [showResults, setShowResults] = useState(!!cachedResults);
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>(cachedResults?.recipes || []);
  const [isAiSource, setIsAiSource] = useState(cachedResults?.isAiSource || false);

  // 调用 AI 推荐接口
  const loadAiRecipes = (filters?: any) => {
    const body = filters || {
      peopleCount,
      prepTime,
      mealType,
      tastePreference,
      useInventory,
    };

    api.post<Recipe[]>("/ai/recommend", body)
      .then((data) => {
        setRecipes(data);
        setIsAiSource(true);
        setIsLoading(false);
        setShowResults(true);
        // 缓存结果
        localStorage.setItem("ai_recommend_cache", JSON.stringify({
          recipes: data, isAiSource: true, filters: body,
        }));
      })
      .catch((err) => {
        console.error("AI recommend failed:", err);
        setIsAiSource(false);
        // 降级：加载数据库已有菜谱
        api.get<Recipe[]>("/recipes")
          .then((data) => {
            setRecipes(data);
            setShowResults(true);
            localStorage.setItem("ai_recommend_cache", JSON.stringify({
              recipes: data, isAiSource: false, filters: body,
            }));
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      });
  };

  useEffect(() => {
    // 如果有缓存结果，直接显示，不重新请求
    if (cachedResults) return;

    if (isQuick) {
      setShowFilters(false);
      setShowResults(false);
      setIsLoading(true);
      
      loadAiRecipes({
        peopleCount,
        prepTime,
        mealType: initialTag || mealType,
        tastePreference,
        useInventory,
      });
    }
  }, [isQuick]);

  const handleGenerate = () => {
    // 清除缓存，强制重新生成
    localStorage.removeItem("ai_recommend_cache");
    setShowFilters(false);
    setShowResults(false);
    setIsLoading(true);
    
    loadAiRecipes();
  };

  const displayRecipes = recipes.slice(0, 3);

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl animate-in slide-in-from-bottom duration-500">
      <div className="pt-8 px-6 pb-12">
        <section className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">筛选条件</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate("/")}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors p-2"
              >
                <span className="text-sm font-medium">返回首页</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-6 pb-6 border-b border-zinc-100">
                  <div className="space-y-4">
                    <label className="font-bold tracking-widest text-zinc-400 uppercase text-xs block">几个人吃</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {["1人", "2人", "3人+"].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setPeopleCount(peopleCount === opt ? "" : opt)}
                          className={cn(
                            "px-6 py-2.5 rounded-full text-sm font-medium transition-all border",
                            peopleCount === opt ? "bg-black text-white border-black" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="font-bold tracking-widest text-zinc-400 uppercase text-xs block">多久能做好</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["10分钟内", "20分钟内", "30分钟内"].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setPrepTime(prepTime === opt ? "" : opt)}
                          className={cn(
                            "px-2 py-2.5 rounded-full text-xs font-medium transition-all border",
                            prepTime === opt ? "bg-black text-white border-black" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="font-bold tracking-widest text-zinc-400 uppercase text-xs block">现在更想吃</label>
                    <div className="grid grid-cols-5 gap-2">
                      {["下午茶", "轻食", "正餐", "饮品", "微醺"].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setMealType(mealType === opt ? "" : opt)}
                          className={cn(
                            "px-2 py-2 rounded-xl text-xs font-medium transition-all border",
                            mealType === opt ? "bg-black text-white border-black" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="font-bold tracking-widest text-zinc-400 uppercase text-xs block">口味偏好</label>
                    <div className="flex flex-wrap gap-2">
                      {["清淡", "甜口", "咸香", "香辣"].map((opt) => (
                        <span
                          key={opt}
                          onClick={() => setTastePreference(tastePreference === opt ? "" : opt)}
                          className={cn(
                            "px-5 py-2 rounded-lg text-sm cursor-pointer transition-all border",
                            tastePreference === opt ? "bg-black text-white border-black" : "bg-white text-zinc-500 border-zinc-200 shadow-sm"
                          )}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 rounded-2xl bg-white shadow-md border border-zinc-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center">
                        <Sparkles size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">优先使用库存</p>
                        <p className="text-[10px] text-zinc-400">减少食物浪费，优化食材利用率</p>
                      </div>
                    </div>
                    <div className="flex bg-zinc-50 p-1 rounded-full border border-zinc-100">
                      <button 
                        onClick={() => setUseInventory(true)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                          useInventory ? "bg-black text-white" : "text-zinc-400"
                        )}
                      >
                        是
                      </button>
                      <button 
                        onClick={() => setUseInventory(false)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                          !useInventory ? "bg-black text-white" : "text-zinc-400"
                        )}
                      >
                        否
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className={cn(
                      "w-full rounded-full bg-black text-white font-bold text-xl flex items-center justify-center gap-3 py-4 shadow-xl active:scale-[0.98] transition-all",
                      isLoading && "opacity-50 cursor-not-allowed scale-95"
                    )}
                  >
                    <Sparkles size={24} className={cn(isLoading && "animate-spin")} />
                    {isLoading ? "菜单生成中..." : "生成菜单"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showResults && (
            <div className="flex justify-center my-4">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors py-2 px-6 text-sm font-medium border border-zinc-200 rounded-full bg-zinc-50 shadow-sm active:scale-95 transition-all"
              >
                筛选条件 {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          )}
        </section>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="py-20 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 rounded-full border-4 border-zinc-100 border-t-black"
                />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black animate-pulse" size={24} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold text-zinc-900">AI 正在为您构思菜单...</p>
                <p className="text-sm text-zinc-400">正在分析您的库存与口味偏好</p>
              </div>
            </motion.div>
          ) : showResults && (
            <motion.section 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">{isAiSource ? "AI 推荐结果" : "推荐菜品"}</h3>
                  {isAiSource ? (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100 flex items-center gap-1">
                      <Sparkles size={10} /> 豆包AI
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-50 text-zinc-400 text-[10px] font-bold rounded-full border border-zinc-100">
                      数据库
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-400">找到 {displayRecipes.length} 个匹配</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {displayRecipes.map((recipe, index) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0,
                      transition: { delay: index * 0.15 } 
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/recipe/${recipe.id}`)}
                    className="group rounded-3xl overflow-hidden border border-zinc-200 p-4 bg-zinc-50/50 hover:bg-zinc-50 transition-colors cursor-pointer relative editorial-shadow"
                  >
                    {recipe.matchPercentage && (
                      <div className="absolute top-4 right-4">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          {recipe.matchPercentage}%
                        </span>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-2xl">
                        <img
                          src={recipe.image}
                          alt={recipe.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-bold truncate">{recipe.name}</h4>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(recipe);
                            }}
                            className={cn(
                              "p-1 rounded-full transition-all active:scale-90",
                              isFavorite(recipe.id) ? "text-red-500" : "text-zinc-300 hover:text-zinc-400"
                            )}
                          >
                            <Heart size={14} fill={isFavorite(recipe.id) ? "currentColor" : "none"} />
                          </button>
                        </div>
                        <p className="text-zinc-500 text-xs line-clamp-2 mb-3 leading-relaxed">{recipe.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> {recipe.time}
                            </span>
                            {recipe.inventoryMatch !== undefined && recipe.inventoryMatch !== null && (
                              <span className="flex items-center gap-1">
                                <Package size={14} /> {recipe.inventoryMatch}种库存
                              </span>
                            )}
                          </div>
                          <button className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
