import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight, Sparkles, Clock, Plus, Check, Trash2, X, ChefHat, ShoppingBasket, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePlan } from "../context/PlanContext";
import { cn } from "../lib/utils";
import { Recipe } from "../types";
import { api } from "../api/client";

export default function Plan() {
  const navigate = useNavigate();
  const { plannedRecipes, removeFromPlan, addToPlan, isInPlan } = usePlan();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [consumeList, setConsumeList] = useState<Array<{name: string, requiredStr: string, amount: number, unit: string, stock: string}>>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[]>([]);
  const [loadingConsume, setLoadingConsume] = useState(false);

  // 从 API 加载推荐菜谱
  useEffect(() => {
    api.get<Recipe[]>("/recipes")
      .then(setSuggestedRecipes)
      .catch((err) => console.error("Failed to load recipes:", err));
  }, []);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === plannedRecipes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(plannedRecipes.map(r => r.id));
    }
  };

  const selectedRecipes = plannedRecipes.filter(r => selectedIds.includes(r.id));

  const [isMissingExpanded, setIsMissingExpanded] = useState(false);

  // 计算所选菜谱中缺失的食材
  const missingItemsMap = new Map<string, string>();
  selectedRecipes.forEach(r => {
    r.ingredients?.missing?.forEach(i => {
      if (i.name) {
        if (!missingItemsMap.has(i.name)) {
          missingItemsMap.set(i.name, i.amount || "适量");
        }
      }
    });
  });
  const missingItems = Array.from(missingItemsMap.entries());
  const missingCount = missingItems.length;

  const handleStartCooking = async () => {
    setLoadingConsume(true);

    // 1) 拉取用户的真实库存
    let inventory: Array<{ name: string; amount: string }> = [];
    try {
      inventory = await api.get<any[]>("/ingredients");
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }

    // 构建库存名 -> 数量 映射
    const stockMap = new Map<string, string>();
    inventory.forEach((inv: any) => {
      if (inv.name) stockMap.set(inv.name, inv.amount || "0");
    });

    // 2) 构建消耗列表 —— 与菜品食材保持完全一致
    const allIngredients = selectedRecipes.flatMap(r => [...r.ingredients.have, ...r.ingredients.missing]);
    const list: Array<{name: string, requiredStr: string, amount: number, unit: string, stock: string}> = [];
    // 用于合并同名食材
    const indexMap = new Map<string, number>();
    
    allIngredients.forEach(i => {
      if (!i.name) return;
      const rawAmount = i.amount || "适量";
      
      // 解析数值和单位（保留原始字符串用于显示）
      const match = rawAmount.match(/^([\d.]+)\s*(.*)$/);
      const val = match ? (parseFloat(match[1]) || 0) : 0;
      const unit = match ? match[2].trim() : rawAmount;

      // 查看真实库存（精确 + 模糊匹配）
      let realStock = "无库存";
      const exactMatch = stockMap.get(i.name);
      if (exactMatch !== undefined) {
        realStock = exactMatch;
      } else {
        for (const [sn, sv] of stockMap) {
          if (sn.includes(i.name) || i.name.includes(sn)) {
            realStock = sv;
            break;
          }
        }
      }

      // 同名同单位合并
      const key = `${i.name}__${unit}`;
      if (indexMap.has(key)) {
        const idx = indexMap.get(key)!;
        list[idx].amount += val;
        list[idx].requiredStr = `${list[idx].amount}${list[idx].unit}`;
      } else {
        indexMap.set(key, list.length);
        list.push({
          name: i.name,
          requiredStr: rawAmount,
          amount: val || 1,
          unit: unit,
          stock: realStock,
        });
      }
    });

    setConsumeList(list);
    setLoadingConsume(false);
    setShowConsumeModal(true);
  };

  const [consuming, setConsuming] = useState(false);

  const confirmConsumption = async () => {
    setConsuming(true);
    try {
      // 调用后端扣减库存接口
      await api.post("/ingredients/consume", {
        items: consumeList.map(item => ({
          name: item.name,
          amount: item.amount,
          unit: item.unit,
        })),
      });
    } catch (err) {
      console.error("Failed to consume ingredients:", err);
      // 即使失败也继续移除计划（食材扣减为辅助功能）
    }

    // 从计划中移除已选菜品
    selectedIds.forEach(id => removeFromPlan(id));
    setSelectedIds([]);
    setShowConsumeModal(false);
    setConsuming(false);
  };



  return (
    <div className="px-6 py-12 space-y-8 animate-in fade-in duration-500 pb-32">
      <section className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">今日计划</h1>
        {plannedRecipes.length > 0 && (
          <button 
            onClick={toggleSelectAll}
            className="text-sm font-bold text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-2"
          >
            {selectedIds.length === plannedRecipes.length ? "取消全选" : "全选所有"}
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
              selectedIds.length === plannedRecipes.length ? "bg-black border-black text-white" : "border-zinc-300"
            )}>
              {selectedIds.length === plannedRecipes.length ? (
                <Check size={12} strokeWidth={3} />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
              )}
            </div>
          </button>
        )}
      </section>

      {plannedRecipes.length > 0 ? (
        <section className="space-y-4">
          <AnimatePresence mode="popLayout">
            {plannedRecipes.map((recipe) => (
              <motion.article
                key={recipe.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                className={cn(
                  "p-3 bg-white border rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer transition-all editorial-shadow relative group",
                  selectedIds.includes(recipe.id) ? "border-black ring-1 ring-black" : "border-zinc-100"
                )}
              >
                <div 
                  onClick={(e) => toggleSelect(recipe.id, e)}
                  className="flex-shrink-0"
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    selectedIds.includes(recipe.id) ? "bg-black border-black text-white" : "border-zinc-200"
                  )}>
                    {selectedIds.includes(recipe.id) && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
                <div className="w-20 h-20 flex-shrink-0 bg-zinc-50 rounded-2xl overflow-hidden">
                  <img
                    src={recipe.image}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex flex-col mb-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-base font-bold text-zinc-900 truncate">{recipe.name}</h5>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-tight line-clamp-1">{recipe.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-[10px] text-zinc-400 font-medium">
                      <Clock size={12} className="mr-1" />
                      <span>{recipe.time}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromPlan(recipe.id);
                  }}
                  className="flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-400 w-8 h-8 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </motion.article>
            ))}
          </AnimatePresence>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-10 border border-zinc-100 shadow-sm flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center">
              <Calendar size={40} className="text-zinc-200" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-900">计划表空空如也</h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-[200px] mx-auto">
                您还没有选择任何菜品，去首页看看 AI 为您推荐了什么？
              </p>
            </div>
            <button 
              onClick={() => navigate("/filters")}
              className="flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-bold text-sm shadow-xl active:scale-95 transition-all"
            >
              <Sparkles size={18} />
              <span>去发现美味</span>
            </button>
          </div>
        </section>
      )}

      <section className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg">猜你喜欢</h4>
          <button 
            onClick={() => navigate("/")}
            className="text-zinc-400 text-xs font-bold flex items-center gap-1"
          >
            查看更多 <ArrowRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {suggestedRecipes.slice(0, 6).map((recipe) => (
            <div 
              key={recipe.id}
              onClick={() => navigate(`/recipe/${recipe.id}`)}
              className="bg-white rounded-3xl p-3 border border-zinc-100 shadow-sm cursor-pointer group"
            >
              <div className="aspect-square rounded-2xl overflow-hidden mb-3">
                <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-grow">
                  <h5 className="font-bold text-sm truncate">{recipe.name}</h5>
                  <span className="text-[10px] text-zinc-400">{recipe.time}</span>
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-90 flex-shrink-0 ${
                    isInPlan(recipe.id) ? "bg-zinc-100 text-zinc-400" : "bg-black text-white"
                  }`}
                >
                  {isInPlan(recipe.id) ? <Check size={16} /> : <Plus size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 固定底部按钮 - 始终显示 */}
      {plannedRecipes.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
          <AnimatePresence>
            {missingCount > 0 && selectedIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="w-full mb-3 bg-gradient-to-r from-orange-50 to-orange-50/80 font-bold border border-orange-200/60 rounded-[28px] overflow-hidden shadow-lg backdrop-blur-md"
              >
                <button 
                  onClick={() => setIsMissingExpanded(!isMissingExpanded)}
                  className="w-full py-3.5 px-5 flex items-center justify-between text-orange-600 active:bg-orange-100/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100/80 p-1 rounded-full"><X size={12} className="text-orange-500" strokeWidth={3} /></div>
                    <span className="text-[14px]">缺少 {missingCount} 种食材，建议先补货</span>
                  </div>
                  {isMissingExpanded ? <ChevronUp size={18} className="text-orange-400" /> : <ChevronDown size={18} className="text-orange-400" />}
                </button>
                <AnimatePresence>
                  {isMissingExpanded && (
                    <motion.div
                       initial={{ height: 0 }}
                       animate={{ height: "auto" }}
                       exit={{ height: 0 }}
                       className="px-5 pb-4"
                    >
                      <div className="flex flex-col gap-2 mt-1">
                         {missingItems.map(([name, amount], idx) => (
                            <div key={idx} className="flex justify-between items-center text-[13px] text-orange-700/80">
                              <span className="font-extrabold">{name}</span>
                              <span className="font-medium bg-orange-100/50 px-2 py-0.5 rounded-md">{amount}</span>
                            </div>
                         ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={handleStartCooking}
            disabled={selectedIds.length === 0 || loadingConsume}
            className={cn(
              "w-full py-5 rounded-full font-bold text-lg shadow-2xl flex items-center justify-center gap-3 transition-all relative z-10",
              selectedIds.length > 0 && !loadingConsume
                ? "bg-black text-white active:scale-95"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
            )}
          >
            {loadingConsume ? <Loader2 size={20} className="animate-spin" /> : <ChefHat size={20} />}
            <span>{loadingConsume ? "加载中..." : `开始烹饪${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}</span>
          </button>
        </div>
      )}

      {/* Ingredient Consumption Modal */}
      <AnimatePresence>
        {showConsumeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConsumeModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-[90vw] md:max-w-md rounded-[2.5rem] p-7 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <button 
                onClick={() => setShowConsumeModal(false)}
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="flex items-start gap-4 mb-6 mt-2 pr-8">
                <div className="w-14 h-14 bg-blue-50/50 text-blue-500 rounded-full flex items-center justify-center shrink-0 border border-blue-100/50">
                  <ShoppingBasket size={24} />
                </div>
                <div className="flex flex-col mt-1">
                  <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">确认食材消耗</h2>
                  <p className="text-zinc-400 text-[11px] mt-1.5 font-medium leading-relaxed">请核对本次烹饪实际消耗的食材总量</p>
                </div>
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar pt-2 pb-4">
                <div className="border border-zinc-100 rounded-[28px] p-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.01)] bg-zinc-50/20">
                  {consumeList.map((item, index) => (
                    <div key={index} className="flex flex-col p-4 bg-white rounded-[20px] border border-zinc-100/80 mb-3 last:mb-0 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-extrabold text-zinc-900 text-[15px]">{item.name}</span>
                        <span className="text-[11px] text-zinc-400 font-bold">所需 {item.requiredStr}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[11px] text-zinc-400 font-bold flex-1 flex items-center">
                          库存 <span className="text-zinc-700 ml-1.5 font-extrabold">{item.stock}</span>
                        </div>
                        <div className="text-zinc-200 mx-2"><ArrowRight size={14} /></div>
                        <div className="flex items-center gap-3 flex-1 justify-end">
                          <span className="text-[11px] text-zinc-400 font-bold">消耗</span>
                          <div className="flex items-center h-[34px] rounded-full border border-zinc-200 bg-white px-3 flex-shrink-0 shadow-sm">
                            <input 
                              type="number" 
                              value={item.amount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const newList = [...consumeList];
                                newList[index].amount = val;
                                setConsumeList(newList);
                              }}
                              className="w-10 text-center bg-transparent focus:outline-none font-bold text-zinc-900 text-[13px]"
                            />
                            {item.unit && <span className="ml-1 text-zinc-400 text-[10px] font-bold">{item.unit}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {consumeList.length === 0 && (
                    <div className="text-center py-8 text-zinc-400 text-sm font-medium">
                      没有可以消耗的食材
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 mt-4">
                <div className="text-center mb-6 mt-1">
                  <p className="text-[11px] text-zinc-400/80 font-bold tracking-wide">如果有新购入食材请及时补充库存哦</p>
                </div>
                <button 
                  onClick={confirmConsumption}
                  disabled={consuming}
                  className={cn(
                    "w-full py-[1.125rem] rounded-[24px] font-bold text-[15px] shadow-xl transition-all flex items-center justify-center gap-2",
                    consuming
                      ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                      : "bg-black text-white active:scale-95"
                  )}
                >
                  {consuming && <Loader2 size={16} className="animate-spin" />}
                  {consuming ? "正在处理..." : "确认消耗并继续"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
