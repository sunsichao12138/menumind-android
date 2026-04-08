import React, { useState } from "react";
import { X, Camera, Mic, Sparkles, Calendar, Tag, Hash, Ruler } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { Ingredient } from "../types";
import { api } from "../api/client";

interface AddIngredientProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: (ingredient: Ingredient) => void;
}

export default function AddIngredient({ isOpen, onClose, onAdded }: AddIngredientProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "蔬菜",
    amount: "",
    unit: "克",
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDays: "7"
  });

  const [processingSource, setProcessingSource] = useState<"camera" | "mic" | "auto" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAiFill = (source: "camera" | "mic" | "auto") => {
    const fillData = () => {
      setFormData({
        name: "新鲜西红柿",
        category: "蔬菜",
        amount: "500",
        unit: "克",
        purchaseDate: new Date().toISOString().split('T')[0],
        expiryDays: "5"
      });
    };

    if (source === "auto") {
      setProcessingSource(source);
      setTimeout(() => {
        fillData();
        setProcessingSource(null);
      }, 1500);
    } else {
      fillData();
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount) return;

    setSubmitting(true);
    try {
      const newIngredient = await api.post<Ingredient>("/ingredients", {
        name: formData.name,
        amount: `${formData.amount} ${formData.unit}`,
        expiryDays: parseInt(formData.expiryDays) || 7,
        category: formData.category,
        image: "",
        suggestions: [],
      });

      if (onAdded) onAdded(newIngredient);

      // 重置表单
      setFormData({
        name: "",
        category: "蔬菜",
        amount: "",
        unit: "克",
        purchaseDate: new Date().toISOString().split('T')[0],
        expiryDays: "7"
      });
      onClose();
    } catch (err) {
      console.error("Failed to add ingredient:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="relative bg-surface w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
          >
            {/* 固定头部 */}
            <header className="flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
              <h1 className="text-2xl font-bold">添加食材</h1>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </header>

            {/* 可滚动的表单区域 */}
            <div className="flex-1 overflow-y-auto px-8 space-y-6 no-scrollbar">
            <section className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleAiFill("camera")}
                className="flex items-center justify-center gap-2 bg-white text-zinc-900 rounded-2xl py-3 px-4 active:scale-95 transition-all border border-zinc-100 shadow-sm"
              >
                <Camera size={18} />
                <span className="text-xs font-bold">拍照识别</span>
              </button>
              <button 
                onClick={() => handleAiFill("mic")}
                className="flex items-center justify-center gap-2 bg-white text-zinc-900 rounded-2xl py-3 px-4 active:scale-95 transition-all border border-zinc-100 shadow-sm"
              >
                <Mic size={18} />
                <span className="text-xs font-bold">语音录入</span>
              </button>
            </section>

            <form className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">食材名称</label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="例如：西红柿" 
                      className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAiFill("auto")}
                    disabled={processingSource === "auto"}
                    className={cn(
                      "flex-shrink-0 bg-black text-white rounded-2xl px-4 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                      processingSource === "auto" && "opacity-50"
                    )}
                    title="自动识别录入"
                  >
                    <Sparkles size={16} className={cn(processingSource === "auto" && "animate-spin")} />
                    <span className="text-xs font-bold">{processingSource === "auto" ? "识别中..." : "自动识别"}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">分类</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium appearance-none"
                    >
                      {["蔬菜", "蛋奶肉类", "主食干货", "调料", "水果", "其他"].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">数量</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <input 
                      type="number" 
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      placeholder="数量" 
                      className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">单位</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <select 
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium appearance-none"
                    >
                      {["克", "千克", "个", "瓶", "盒", "袋"].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">预期存放天数</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <input 
                      type="number" 
                      value={formData.expiryDays}
                      onChange={(e) => setFormData({...formData, expiryDays: e.target.value})}
                      placeholder="天数" 
                      className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">购买日期</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
                    className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </form>
            </div>

            {/* 固定底部按钮 */}
            <div className="flex-shrink-0 px-8 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] bg-surface border-t border-zinc-100">
            <button 
              onClick={handleSubmit}
              disabled={submitting || !formData.name || !formData.amount}
              className={cn(
                "w-full bg-black text-white py-4 rounded-full font-bold shadow-xl active:scale-95 transition-all",
                (submitting || !formData.name || !formData.amount) && "opacity-50 cursor-not-allowed"
              )}
            >
              {submitting ? "添加中..." : "确认添加"}
            </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
