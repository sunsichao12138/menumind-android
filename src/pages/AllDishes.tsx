import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Check, Clock, Package, Search } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { usePlan } from "../context/PlanContext";
import { Recipe } from "../types";
import { api } from "../api/client";

export default function AllDishes() {
  const navigate = useNavigate();
  const { addToPlan, removeFromPlan, isInPlan } = usePlan();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");

  useEffect(() => {
    api.get<Recipe[]>("/recipes")
      .then((data) => {
        // 过滤掉 AI 生成的临时菜谱，只保留种子菜谱
        const seedRecipes = data.filter((r) => !r.id.startsWith("ai_"));
        setRecipes(seedRecipes);
      })
      .catch((err) => console.error("Failed to load recipes:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface max-w-md mx-auto flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "全部" || (r.tags && r.tags.includes(activeCategory));
    return matchesSearch && matchesCategory;
  });

  // 分成两列实现瀑布流
  const col1: Recipe[] = [];
  const col2: Recipe[] = [];
  filteredRecipes.forEach((r, i) => {
    if (i % 2 === 0) col1.push(r);
    else col2.push(r);
  });

  const RecipeCard = ({ recipe, index }: { recipe: Recipe; index: number }) => {
    const planned = isInPlan(recipe.id);
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { delay: index * 0.03 } }}
        className="rounded-2xl overflow-hidden bg-white border border-zinc-100 shadow-sm mb-3"
      >
        <div
          className="cursor-pointer"
          onClick={() => navigate(`/recipe/${recipe.id}`)}
        >
          <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-100">
            <img
              src={recipe.image}
              alt={recipe.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="p-2.5 pb-1">
            <h4 className="text-[13px] font-bold text-zinc-900 truncate mb-1">{recipe.name}</h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
              <span className="flex items-center gap-0.5">
                <Clock size={10} /> {recipe.time}
              </span>
              {recipe.inventoryMatch !== undefined && recipe.inventoryMatch !== null && recipe.inventoryMatch > 0 && (
                <span className="flex items-center gap-0.5 text-emerald-500">
                  <Package size={10} /> {recipe.inventoryMatch}种库存
                </span>
              )}
            </div>
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {recipe.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-zinc-50 text-[9px] text-zinc-500 rounded-full border border-zinc-100">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-2.5 pb-2.5">
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-zinc-50">
            <div className="text-[10px] font-bold">
              {(recipe.ingredients?.missing?.length || 0) > 0 ? (
                <span className="text-orange-500">缺少 {recipe.ingredients.missing.length} 种食材</span>
              ) : (
                <span className="text-emerald-500">食材齐全</span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (planned) {
                  removeFromPlan(recipe.id);
                } else {
                  addToPlan(recipe);
                }
              }}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm",
                planned
                  ? "bg-zinc-100 text-zinc-400 border border-zinc-200"
                  : "bg-black text-white"
              )}
            >
              {planned ? <Check size={14} /> : <Plus size={14} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">全部菜品</h1>
        <span className="text-xs text-zinc-400 font-medium ml-auto">{filteredRecipes.length} 道菜</span>
      </header>

      {/* 搜索与分类 */}
      <div className="px-6 py-2 space-y-4 bg-surface sticky top-[72px] z-40 pb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="搜索菜品..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-100 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all shadow-sm"
          />
        </div>
        
        <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-6 px-6">
          {["全部", "家常菜", "快手菜", "下饭菜", "高蛋白", "低卡", "主食", "甜品", "西餐", "小食", "汤羹"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all active:scale-95",
                activeCategory === cat 
                  ? "bg-black text-white border-black shadow-md" 
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-24">
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col">
            {col1.map((recipe, i) => (
              <div key={recipe.id}><RecipeCard recipe={recipe} index={i * 2} /></div>
            ))}
          </div>
          <div className="flex-1 flex flex-col">
            {col2.map((recipe, i) => (
              <div key={recipe.id}><RecipeCard recipe={recipe} index={i * 2 + 1} /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
