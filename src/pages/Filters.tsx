import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles, Package, Clock, Plus, Heart, Check, ChevronsDown, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useFavorites } from "../context/FavoritesContext";
import { usePlan } from "../context/PlanContext";
import { Recipe } from "../types";
import { api } from "../api/client";

export default function Filters() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQuick = searchParams.get("quick") === "true";
  const initialTag = searchParams.get("tag");
  const { toggleFavorite, isFavorite } = useFavorites();
  const { addToPlan, removeFromPlan, isInPlan } = usePlan();

  // 尝试从缓存恢复上次推荐结果
  const cachedResults = (() => {
    try {
      const raw = localStorage.getItem("ai_recommend_cache");
      if (raw) return JSON.parse(raw) as { recipes: Recipe[]; isAiSource: boolean; filters: any };
    } catch {}
    return null;
  })();

  const [showDetailedFilters, setShowDetailedFilters] = useState(false);
  const [peopleCount, setPeopleCount] = useState(cachedResults?.filters?.peopleCount || "2人");
  const [prepTime, setPrepTime] = useState(cachedResults?.filters?.prepTime || "30分钟内");
  const [mealType, setMealType] = useState(initialTag || cachedResults?.filters?.mealType || "正餐");
  const [tastePreference, setTastePreference] = useState(cachedResults?.filters?.tastePreference || "咸香");
  const [drinkAlcohol, setDrinkAlcohol] = useState(cachedResults?.filters?.drinkAlcohol || "无酒精");
  const [useInventory, setUseInventory] = useState(cachedResults?.filters?.useInventory ?? true);
  const [showResults, setShowResults] = useState(!!cachedResults);
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>(cachedResults?.recipes || []);
  const [isAiSource, setIsAiSource] = useState(cachedResults?.isAiSource || false);

  const loadAiRecipes = (filters?: any) => {
    const body = filters || {
      peopleCount,
      prepTime,
      mealType: mealType === "饮品" ? `饮品(${drinkAlcohol})` : mealType,
      tastePreference,
      useInventory,
    };

    api.post<Recipe[]>("/ai/recommend", body)
      .then((data) => {
        setRecipes(data);
        setIsAiSource(true);
        setIsLoading(false);
        setShowResults(true);
        localStorage.setItem("ai_recommend_cache", JSON.stringify({
          recipes: data, isAiSource: true, filters: { ...body, drinkAlcohol },
        }));
      })
      .catch((err) => {
        console.error("AI recommend failed:", err);
        setIsAiSource(false);
        api.get<Recipe[]>("/recipes")
          .then((data) => {
            setRecipes(data);
            setShowResults(true);
            localStorage.setItem("ai_recommend_cache", JSON.stringify({
              recipes: data, isAiSource: false, filters: { ...body, drinkAlcohol },
            }));
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      });
  };

  useEffect(() => {
    if (cachedResults) return;
    if (isQuick) {
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
    localStorage.removeItem("ai_recommend_cache");
    setShowResults(false);
    setIsLoading(true);
    setShowAll(false);
    loadAiRecipes();
  };

  const [showAll, setShowAll] = useState(false);
  const displayRecipes = showAll ? recipes.slice(0, 10) : recipes.slice(0, 5);

  const mealTypes = [
    { label: "正餐", emoji: "🍳" },
    { label: "轻食", emoji: "🥗" },
    { label: "早餐", emoji: "🥞" },
    { label: "下午茶", emoji: "🍰" },
    { label: "饮品", emoji: "🧋" },
  ];

  const getTasteOptions = () => {
    if (mealType === "饮品") return ["冰爽", "常温", "热饮", "甜口", "微酸"];
    if (mealType === "下午茶") return ["甜口", "咸口", "清淡", "奶香"];
    return ["清淡", "甜口", "咸香", "香辣"];
  };

  const showPeopleFilter = ["正餐", "轻食", "早餐"].includes(mealType);
  const showTimeFilter = ["正餐", "早餐"].includes(mealType);
  const showAlcoholFilter = mealType === "饮品";
  const tasteLabel = mealType === "饮品" ? "口感偏好" : "口味偏好";

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl animate-in slide-in-from-bottom duration-500">
      <div className="pt-8 px-6 pb-12">

        {/* ═══ 头部 ═══ */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">智能推荐</h3>
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors p-2"
          >
            <span className="text-sm font-medium">返回首页</span>
            <ArrowRight size={20} />
          </button>
        </div>

        {/* ═══ 快速筛选 ═══ */}
        <div className="space-y-3 mb-5">
          <label className="font-bold tracking-widest text-zinc-400 uppercase text-[10px] block">快速筛选</label>
          <div className="flex flex-wrap gap-2">
            {mealTypes.map(({ label, emoji }) => (
              <button
                key={label}
                onClick={() => setMealType(mealType === label ? "" : label)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  mealType === label
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-white text-zinc-700 border-zinc-200 shadow-sm"
                )}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* 优先使用库存 - 放在快速筛选中 */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white shadow-sm border border-zinc-100 mt-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Package size={16} className="text-primary" />
              </div>
              <p className="font-bold text-sm">优先使用库存</p>
            </div>
            <div className="flex bg-zinc-50 p-1 rounded-full border border-zinc-100">
              <button 
                onClick={() => setUseInventory(true)}
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-bold transition-all",
                  useInventory ? "bg-primary text-white shadow-sm" : "text-zinc-400"
                )}
              >
                是
              </button>
              <button 
                onClick={() => setUseInventory(false)}
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-bold transition-all",
                  !useInventory ? "bg-primary text-white shadow-sm" : "text-zinc-400"
                )}
              >
                否
              </button>
            </div>
          </div>
        </div>

        {/* ═══ 详细筛选 ═══ */}
        <div className="mb-5">
          <label className="font-bold tracking-widest text-zinc-400 uppercase text-[10px] block mb-3">详细筛选</label>
          
          <div className="relative">
            {/* 详细筛选内容区 */}
            <div className={cn(
              "space-y-4 transition-all duration-300",
              !showDetailedFilters && "max-h-[0px] overflow-hidden"
            )}>

              {/* 人数 */}
              {showPeopleFilter && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500">几个人吃</label>
                  <div className="flex gap-2">
                    {["1人", "2人", "3人+"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setPeopleCount(peopleCount === opt ? "" : opt)}
                        className={cn(
                          "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                          peopleCount === opt ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 烹饪时间 */}
              {showTimeFilter && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500">多久能做好</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["10分钟内", "20分钟内", "30分钟内"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setPrepTime(prepTime === opt ? "" : opt)}
                        className={cn(
                          "px-2 py-2 rounded-full text-xs font-medium transition-all border",
                          prepTime === opt ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 饮品 → 酒精/无酒精 */}
              {showAlcoholFilter && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500">饮品类型</label>
                  <div className="flex gap-2">
                    {["无酒精", "含酒精"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setDrinkAlcohol(drinkAlcohol === opt ? "" : opt)}
                        className={cn(
                          "px-5 py-2 rounded-full text-sm font-medium transition-all border",
                          drinkAlcohol === opt ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-white text-zinc-900 border-zinc-200 shadow-sm"
                        )}
                      >
                        {opt === "含酒精" ? "🍷 含酒精" : "🧃 无酒精"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 口味偏好 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500">{tasteLabel}</label>
                <div className="flex flex-wrap gap-2">
                  {getTasteOptions().map((opt) => (
                    <span
                      key={opt}
                      onClick={() => setTastePreference(tastePreference === opt ? "" : opt)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm cursor-pointer transition-all border",
                        tastePreference === opt ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-white text-zinc-500 border-zinc-200 shadow-sm"
                      )}
                    >
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 渐变遮挡 + 查看更多按钮（未展开时） */}
            {!showDetailedFilters && (
              <div className="relative mt-0">
                <div className="absolute bottom-full left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
                <button
                  onClick={() => setShowDetailedFilters(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-primary text-sm font-bold hover:text-orange-600 active:scale-95 transition-all"
                >
                  查看更多筛选条件
                  <ChevronDown size={16} />
                </button>
              </div>
            )}

            {/* 收起按钮（已展开时） */}
            {showDetailedFilters && (
              <button
                onClick={() => setShowDetailedFilters(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 text-zinc-400 text-sm font-medium hover:text-zinc-600 active:scale-95 transition-all"
              >
                收起筛选条件
                <ChevronDown size={16} className="rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* 生成按钮 */}
        <button 
          onClick={handleGenerate}
          disabled={isLoading || !mealType}
          className={cn(
            "w-full rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 py-3.5 mb-8 shadow-xl shadow-primary/30 active:scale-[0.98] transition-all hover:bg-orange-600",
            (isLoading || !mealType) && "opacity-50 cursor-not-allowed scale-95"
          )}
        >
          <Sparkles size={20} className={cn(isLoading && "animate-spin")} />
          {isLoading ? "生成中..." : "生成菜单"}
        </button>

        {/* ═══ 加载 & 结果 ═══ */}
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
                  className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary"
                />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
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
                <h3 className="text-xl font-bold">{isAiSource ? "AI 推荐结果" : "推荐菜品"}</h3>
                <button
                  onClick={() => navigate("/all-dishes")}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1"
                >
                  查看全部菜品 <ArrowRight size={14} />
                </button>
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
                    {recipe.matchPercentage != null && recipe.matchPercentage > 0 && (
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
                      <div className="flex-1 min-w-0">
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
                        <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock size={14} /> {recipe.time}
                          </span>
                          {recipe.inventoryMatch !== undefined && recipe.inventoryMatch !== null && recipe.inventoryMatch > 0 && (
                            <span className="flex items-center gap-1">
                              <Package size={14} /> {recipe.inventoryMatch}种库存
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isInPlan(recipe.id)) {
                            removeFromPlan(recipe.id);
                          } else {
                            addToPlan(recipe);
                          }
                        }}
                        className={cn(
                          "flex-shrink-0 self-center w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all",
                          isInPlan(recipe.id) ? "bg-surface-container-low text-on-surface-variant" : "bg-primary text-white shadow-md shadow-primary/30"
                        )}
                      >
                        {isInPlan(recipe.id) ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {!showAll && recipes.length > 5 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.8 } }}
                  onClick={() => setShowAll(true)}
                  className="w-full flex items-center justify-center gap-1 py-3 text-zinc-400 text-sm font-medium hover:text-zinc-600 active:scale-95 transition-all"
                >
                  查看更多
                  <ChevronsDown size={14} />
                </motion.button>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
