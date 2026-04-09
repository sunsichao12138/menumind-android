import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, Search, Trash2 } from "lucide-react";
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

  const deleteIngredient = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // 乐观删除
    setIngredients(prev => prev.filter(item => item.id !== id));
    api.delete(`/ingredients/${id}`).catch((err) => {
      console.error("Failed to delete ingredient:", err);
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setIngredients(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      
      const currentAmount = parseFloat(item.amount) || 0;
      const unit = item.amount.replace(/[0-9.]/g, '').trim();
      const newAmount = currentAmount + delta;

      if (newAmount <= 0) {
        // 小于等于0 自动删除
        api.delete(`/ingredients/${id}`).catch(err => console.error("Failed to delete:", err));
        return prev.filter(i => i.id !== id);
      } else {
        // 正常更新数量
        const newAmountStr = `${newAmount} ${unit}`.trim();
        api.patch(`/ingredients/${id}`, { amount: newAmountStr }).catch(err => console.error("Failed to update:", err));
        return prev.map(i => i.id === id ? { ...i, amount: newAmountStr } : i);
      }
    });
  };

  const handleAmountChange = (id: string, value: string) => {
    setIngredients(prev => prev.map(item => {
      if (item.id === id) {
        const unit = item.amount.replace(/[0-9.]/g, '').trim();
        return { ...item, amount: `${value} ${unit}`.trim() };
      }
      return item;
    }));
  };

  const handleAmountBlur = (id: string) => {
    setIngredients(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      
      const parsedVal = parseFloat(item.amount);
      if (isNaN(parsedVal) || parsedVal <= 0) {
        api.delete(`/ingredients/${id}`).catch(err => console.error(err));
        return prev.filter(i => i.id !== id);
      } else {
        const unit = item.amount.replace(/[0-9.]/g, '').trim();
        const newAmountStr = `${parsedVal} ${unit}`.trim();
        api.patch(`/ingredients/${id}`, { amount: newAmountStr }).catch(err => console.error(err));
        return prev.map(i => i.id === id ? { ...i, amount: newAmountStr } : i);
      }
    });
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
          <div className="bg-black text-white rounded-[28px] shadow-lg relative overflow-hidden py-4 px-5">
            <div className="relative z-10">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-2.5 rounded-[20px]">
                  <span className="text-2xl font-bold text-white">{ingredients.length}</span>
                  <span className="text-[9px] font-bold mt-0.5 text-zinc-300">现有食材</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-2.5 rounded-[20px]">
                  <span className="text-2xl font-bold text-red-400">{expiringCount}</span>
                  <span className="text-[9px] font-bold mt-0.5 text-zinc-300">快过期</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800 py-2.5 rounded-[20px]">
                  <span className={cn("text-2xl font-bold", expiredCount > 0 ? "text-orange-400" : "text-white")}>{expiredCount}</span>
                  <span className="text-[9px] font-bold mt-0.5 text-zinc-300">已过期</span>
                </div>
              </div>
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
            {["全部", "临期", "蔬菜", "水果", "蛋奶肉类", "海鲜水产", "主食干货", "豆制品", "调料", "饮品", "零食"].map((cat) => (
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
                      className="w-8 h-8 rounded-full border border-zinc-200 flex flex-shrink-0 items-center justify-center text-lg active:bg-zinc-50 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <input 
                      type="number"
                      value={item.amount.replace(/[^\d.]/g, '')}
                      onChange={(e) => handleAmountChange(item.id, e.target.value)}
                      onBlur={() => handleAmountBlur(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-12 text-center text-sm font-bold bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none transition-colors"
                    />
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full border border-zinc-200 flex flex-shrink-0 items-center justify-center text-lg active:bg-zinc-50 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="text-xs text-zinc-400 font-medium ml-1 mr-2">{unit}</span>
                    <div className="w-[1px] h-4 bg-zinc-200"></div>
                    <button 
                      onClick={(e) => deleteIngredient(item.id, e)}
                      className="w-8 h-8 rounded-full border border-red-100 bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 active:bg-red-200 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
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
