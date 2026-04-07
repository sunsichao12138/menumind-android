import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "motion/react";
import AddIngredient from "./AddIngredient";
import { Ingredient } from "../types";
import { api } from "../api/client";

export default function Fridge() {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 从 API 加载食材
  useEffect(() => {
    api.get<Ingredient[]>("/ingredients")
      .then(setIngredients)
      .catch((err) => console.error("Failed to load ingredients:", err))
      .finally(() => setLoadingIngredients(false));
  }, []);

  const updateQuantity = (id: string, delta: number) => {
    setIngredients(prev => prev.map(item => {
      if (item.id === id) {
        const currentAmount = parseInt(item.amount);
        const unit = item.amount.replace(/[0-9]/g, '').trim();
        const newAmount = Math.max(0, currentAmount + delta);
        const newAmountStr = `${newAmount} ${unit}`;
        
        // 调用 API 更新
        api.patch(`/ingredients/${id}`, { amount: newAmountStr }).catch((err) => {
          console.error("Failed to update ingredient:", err);
        });

        return { ...item, amount: newAmountStr };
      }
      return item;
    }));
  };

  const handleIngredientAdded = (newIngredient: Ingredient) => {
    setIngredients(prev => [newIngredient, ...prev]);
  };

  const filteredIngredients = ingredients.filter(item => {
    const matchesCategory = activeCategory === "全部" || 
                           (activeCategory === "临期" ? item.expiryDays <= 3 : item.category === activeCategory);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const expiringCount = ingredients.filter(i => i.expiryDays <= 3 && i.expiryDays > 0).length;
  const expiredCount = ingredients.filter(i => i.expiryDays <= 0).length;

  return (
    <div className="px-6 py-12 space-y-5 animate-in fade-in duration-500">
      <section>
        <h1 className="text-3xl font-bold text-on-surface">冰箱管理</h1>
      </section>

      <main className="space-y-4">
        <section className="mt-1">
          <div className="bg-black text-white rounded-3xl shadow-lg relative overflow-hidden py-6 px-8">
            <div className="relative z-10">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-3 rounded-2xl">
                  <span className="text-2xl font-bold text-white">{ingredients.length}</span>
                  <span className="text-[10px] font-bold mt-0.5 text-zinc-300">现有食材</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-3 rounded-2xl">
                  <span className="text-2xl font-bold text-red-400">{expiringCount}</span>
                  <span className="text-[10px] font-bold mt-0.5 text-zinc-300">快过期</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-3 rounded-2xl">
                  <span className={cn("text-2xl font-bold", expiredCount > 0 ? "text-orange-400" : "text-white")}>{expiredCount}</span>
                  <span className="text-[10px] font-bold mt-0.5 text-zinc-300">已过期</span>
                </div>
              </div>
              <button 
                onClick={() => navigate("/filters?quick=true&tag=清库存")}
                className="w-full bg-white text-black py-4 rounded-full font-bold text-sm tracking-wide active:scale-95 transition-all"
              >
                用当前库存推荐菜单
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zinc-800 to-transparent opacity-50 rounded-full -mr-16 -mt-16"></div>
          </div>
        </section>

        <section className="flex gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex-shrink-0 flex flex-row items-center justify-center gap-2 bg-white rounded-2xl shadow-sm border border-zinc-100 hover:bg-zinc-50 transition-colors active:scale-95 py-3 px-8"
          >
            <Plus className="text-black" size={18} />
            <span className="text-xs font-bold whitespace-nowrap">添加食材</span>
          </button>
          <div className="flex-shrink relative min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="搜索食材..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-full bg-white border border-zinc-100 rounded-2xl pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all shadow-sm"
            />
          </div>
        </section>

        <section className="sticky top-0 z-40 bg-surface -mx-6 py-4">
          <div className="flex overflow-x-auto no-scrollbar px-6 gap-2">
            {["全部", "临期", "蔬菜", "蛋奶肉类", "主食干货", "调料"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-colors",
                  activeCategory === cat ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {loadingIngredients ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <p className="font-bold">暂无食材</p>
            </div>
          ) : (
            filteredIngredients.map((item) => {
              const numericAmount = parseInt(item.amount) || 0;
              const unit = item.amount.replace(/[0-9]/g, '').trim();
              return (
              <div
                key={item.id}
                className="group bg-white p-3 rounded-3xl flex items-center gap-4 border border-zinc-100 hover:shadow-md transition-all shadow-sm"
              >
                <div className="flex-grow">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded",
                      item.expiryDays <= 3 ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-500"
                    )}>
                      {item.expiryDays}天内
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-lg active:bg-zinc-50 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-sm font-bold w-10 text-center">{numericAmount}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-lg active:bg-zinc-50 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-xs text-zinc-400 font-medium">{unit}</span>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </section>
      </main>

      <AddIngredient 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onAdded={handleIngredientAdded}
      />
    </div>
  );
}
