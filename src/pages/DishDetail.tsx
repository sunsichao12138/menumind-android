import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Sparkles, CheckCircle, ShoppingBasket, Plus, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { usePlan } from "../context/PlanContext";
import { useFavorites } from "../context/FavoritesContext";
import { useHistory } from "../context/HistoryContext";
import { Recipe, Ingredient } from "../types";
import { api } from "../api/client";

export default function DishDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">("ingredients");
  const { addToPlan, removeFromPlan, isInPlan } = usePlan();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { addToHistory } = useHistory();
  const [inventory, setInventory] = useState<Ingredient[]>([]);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  // 从 API 加载菜谱详情
  useEffect(() => {
    if (!id) return;
    api.get<Recipe>(`/recipes/${id}`)
      .then((data) => {
        // 尝试从本地缓存中找回 AI 生成的推荐理由
        try {
          const raw = localStorage.getItem("ai_recommend_cache");
          if (raw) {
            const cached = JSON.parse(raw);
            const cachedRecipe = cached.recipes?.find((r: Recipe) => r.id === data.id);
            if (cachedRecipe && cachedRecipe.recommendationReason) {
              data.recommendationReason = cachedRecipe.recommendationReason;
            }
          }
        } catch (e) {}

        setRecipe(data);
        addToHistory(data);
      })
      .catch((err) => console.error("Failed to load recipe:", err))
      .finally(() => setLoading(false));
    // 加载用户库存，用于显示实际数量
    api.get<Ingredient[]>("/ingredients")
      .then(setInventory)
      .catch(() => {});
  }, [id]);

  // 查找食材在库存中的实际数量
  const getInventoryAmount = (name: string): string | null => {
    const found = inventory.find(i => i.name.includes(name) || name.includes(i.name));
    return found ? found.amount : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto flex items-center justify-center">
        <p className="text-zinc-400 font-bold">菜谱未找到</p>
      </div>
    );
  }

  const isPlanned = isInPlan(recipe.id);
  const favorited = isFavorite(recipe.id);

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto relative shadow-2xl animate-in fade-in duration-500">
      <header className="fixed top-0 w-full max-w-md z-50 bg-white/70 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <button 
          onClick={() => toggleFavorite(recipe)}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90",
            favorited ? "text-red-500 bg-red-50" : "text-zinc-900 hover:bg-zinc-100"
          )}
        >
          <Heart size={24} fill={favorited ? "currentColor" : "none"} />
        </button>
      </header>

      <main className="px-6 pt-24 pb-48">
        <section className="mb-8">
          <div className="aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden bg-zinc-100 editorial-shadow">
            <img
              src={recipe.image}
              alt={recipe.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </section>

        <section className="mb-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 leading-tight mb-2">
            {recipe.name}
          </h1>
          <p className="text-zinc-500 text-base">
            {recipe.description}
          </p>
        </section>

        <section className="flex flex-wrap gap-2 mb-8">
          <span className="px-4 py-1.5 bg-black text-white text-[11px] font-bold rounded-full">
            {recipe.tags[0]}
          </span>
          <span className="px-4 py-1.5 bg-zinc-50 text-zinc-500 text-[11px] font-bold rounded-full border border-zinc-100">
            {recipe.time}
          </span>
          <span className="px-4 py-1.5 bg-zinc-50 text-zinc-500 text-[11px] font-bold rounded-full border border-zinc-100">
            {recipe.difficulty}
          </span>
          <span className="px-4 py-1.5 bg-zinc-50 text-zinc-500 text-[11px] font-bold rounded-full border border-zinc-100">
            约 {recipe.calories}
          </span>
        </section>

        {recipe.recommendationReason && (
          <section className="mb-10">
            <div className="bg-[#F7FBF9] p-6 rounded-3xl border border-[#E8F3ED]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <Sparkles className="text-[#4CAF50]" size={16} />
                </div>
                <p className="text-zinc-700 leading-relaxed text-sm">
                  <span className="font-bold text-zinc-900">推荐理由：</span>{recipe.recommendationReason}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-end gap-8 mb-6">
            <button
              onClick={() => setActiveTab("ingredients")}
              className={cn(
                "pb-2 text-xl font-bold transition-all relative",
                activeTab === "ingredients" ? "text-zinc-900" : "text-zinc-300 hover:text-zinc-400"
              )}
            >
              食材清单
              {activeTab === "ingredients" && (
                <motion.div layoutId="activeTab" className="absolute -bottom-1 left-0 right-0 h-1 bg-black rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("steps")}
              className={cn(
                "pb-2 text-xl font-bold transition-all relative",
                activeTab === "steps" ? "text-zinc-900" : "text-zinc-300 hover:text-zinc-400"
              )}
            >
              做法步骤
              {activeTab === "steps" && (
                <motion.div layoutId="activeTab" className="absolute -bottom-1 left-0 right-0 h-1 bg-black rounded-full" />
              )}
            </button>
          </div>

          {activeTab === "ingredients" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50/50 p-5 rounded-[2rem] border border-zinc-100">
                <h3 className="text-[10px] font-bold text-zinc-400 mb-4 tracking-widest flex items-center gap-2 uppercase">
                  <CheckCircle size={12} className="text-zinc-300" />
                  你已有
                </h3>
                <ul className="space-y-3">
                  {recipe.ingredients.have.map((ing, i) => {
                    const realAmount = getInventoryAmount(ing.name);
                    return (
                      <li key={i} className="flex flex-col gap-0.5">
                        <span className="text-zinc-900 font-bold text-sm">{ing.name}</span>
                        <span className="text-zinc-400 text-[10px]">需 {ing.amount}</span>
                        {realAmount && (
                          <span className="text-emerald-500 text-[10px] font-medium">库存 {realAmount}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="bg-zinc-50/50 p-5 rounded-[2rem] border border-zinc-100">
                <h3 className="text-[10px] font-bold text-zinc-400 mb-4 tracking-widest flex items-center gap-2 uppercase">
                  <ShoppingBasket size={12} className="text-zinc-300" />
                  你还缺
                </h3>
                <ul className="space-y-3">
                  {recipe.ingredients.missing.map((ing, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      <span className="text-zinc-900 font-bold text-sm">{ing.name}</span>
                      <span className="text-zinc-400 text-[10px]">{ing.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(recipe.steps && recipe.steps.length > 0 ? recipe.steps : ['大火快炒，锁住食材水分，保持口感。', '加入调料翻炒均匀。', '出锅装盘即可。']).map((step, index) => (
                <div key={index} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </span>
                  <p className="text-zinc-600 text-sm leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
          <button 
            onClick={() => {
              if (isPlanned) {
                removeFromPlan(recipe.id);
              } else {
                addToPlan(recipe);
              }
            }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold text-base transition-all active:scale-95 shadow-2xl",
              isPlanned 
                ? "bg-zinc-100 border-2 border-zinc-200 text-zinc-400" 
                : "bg-black text-white"
            )}
          >
            {isPlanned ? <Check size={18} /> : <Plus size={18} />}
            <span>{isPlanned ? "已在计划" : "加入计划"}</span>
          </button>
        </section>
      </main>


    </div>
  );
}
