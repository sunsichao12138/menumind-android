import React, { useState, useRef } from "react";
import { X, Camera, Mic, Sparkles, Calendar, Tag, Hash, Ruler, Loader2, Image as ImageIcon } from "lucide-react";
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
  const [recognizeError, setRecognizeError] = useState("");
  const [showImageSourcePicker, setShowImageSourcePicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 压缩base64图片
  const compressBase64 = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  // 压缩File图片并转为 base64（兜底用）
  const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => compressBase64(reader.result as string).then(resolve).catch(reject);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 发送图片到AI识别
  const recognizeImage = async (base64: string) => {
    setProcessingSource("camera");
    setRecognizeError("");
    try {
      const compressed = await compressBase64(base64);
      const result = await api.post<any>("/ai/recognize-image", { image: compressed });
      setFormData({
        name: result.name || "",
        category: result.category || "蔬菜",
        amount: String(result.amount || ""),
        unit: result.unit || "克",
        purchaseDate: result.purchaseDate || new Date().toISOString().split('T')[0],
        expiryDays: String(result.expiryDays || "7"),
      });
    } catch (err: any) {
      console.error("Image recognition failed:", err);
      setRecognizeError(err.message || "识别失败，请重试");
    } finally {
      setProcessingSource(null);
    }
  };

  // 兜底：HTML file input 回调
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressFile(file);
      await recognizeImage(base64);
    } catch (err: any) {
      setRecognizeError("读取图片失败");
    }
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleAiFill = async (source: "camera_capture" | "camera_photos" | "mic" | "auto") => {
    if (source === "camera_capture" || source === "camera_photos") {
      setShowImageSourcePicker(false);
      try {
        // 使用 Capacitor Camera，明确指定 source 避免弹出原生未自定义样式的 Prompt
        const { Camera: CapCamera, CameraResultType, CameraSource } = await import("@capacitor/camera");
        const photo = await CapCamera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: source === "camera_capture" ? CameraSource.Camera : CameraSource.Photos,
          quality: 80,
          width: 800,
          height: 800,
        });
        if (photo.dataUrl) {
          await recognizeImage(photo.dataUrl);
        }
      } catch (err: any) {
        // 如果 Capacitor 不可用或用户取消，回退到 HTML input
        if (err.message?.includes("cancelled") || err.message?.includes("cancel")) {
          return; // 用户取消，不做任何事
        }
        console.log("Capacitor Camera not available, falling back to file input");
        cameraInputRef.current?.click();
      }
      return;
    }

    if (source === "auto") {
      if (!formData.name.trim()) {
        setRecognizeError("请先输入食材名称");
        return;
      }
      setProcessingSource("auto");
      setRecognizeError("");
      try {
        const result = await api.post<any>("/ai/auto-fill", { name: formData.name.trim() });
        setFormData(prev => ({
          ...prev,
          category: result.category || prev.category,
          amount: String(result.amount || prev.amount),
          unit: result.unit || prev.unit,
          purchaseDate: result.purchaseDate || prev.purchaseDate,
          expiryDays: String(result.expiryDays || prev.expiryDays),
        }));
      } catch (err: any) {
        console.error("Auto-fill failed:", err);
        setRecognizeError(err.message || "自动识别失败，请重试");
      } finally {
        setProcessingSource(null);
      }
      return;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 隐藏的相机/相册输入 */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />

          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-surface w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* 识别中遮罩 */}
            <AnimatePresence>
              {(processingSource === "camera" || processingSource === "auto") && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 size={40} className="animate-spin text-black" />
                  <span className="text-sm font-bold text-zinc-600">AI 正在识别食材...</span>
                </motion.div>
              )}
            </AnimatePresence>

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
            <div className="flex-1 overflow-y-auto px-8 space-y-4 no-scrollbar">
            <section className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => setShowImageSourcePicker(true)}
                disabled={processingSource === "camera"}
                className={cn(
                  "flex items-center justify-center gap-2 bg-white text-zinc-900 rounded-xl py-2.5 px-4 active:scale-95 transition-all border border-zinc-100 shadow-sm",
                  processingSource === "camera" && "opacity-50"
                )}
              >
                <Camera size={18} />
                <span className="text-xs font-bold">拍照识别</span>
              </button>
              <button 
                onClick={() => handleAiFill("mic")}
                className="flex items-center justify-center gap-2 bg-white text-zinc-900 rounded-xl py-2.5 px-4 active:scale-95 transition-all border border-zinc-100 shadow-sm"
              >
                <Mic size={18} />
                <span className="text-xs font-bold">语音录入</span>
              </button>
            </section>

            {/* 识别错误提示 */}
            {recognizeError && (
              <div className="text-xs text-red-500 font-medium bg-red-50 px-4 py-2 rounded-xl">
                {recognizeError}
              </div>
            )}

            <form className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">食材名称</label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="例如：西红柿" 
                      className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAiFill("auto")}
                    disabled={processingSource === "auto"}
                    className={cn(
                      "flex-shrink-0 bg-primary text-white shadow-md shadow-primary/30 rounded-2xl px-4 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                      processingSource === "auto" && "opacity-50"
                    )}
                    title="自动识别录入"
                  >
                    <Sparkles size={16} className={cn(processingSource === "auto" && "animate-spin")} />
                    <span className="text-xs font-bold">{processingSource === "auto" ? "识别中..." : "自动识别"}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">分类</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium appearance-none"
                    >
                      {["蔬菜", "水果", "蛋奶肉类", "海鲜水产", "主食干货", "豆制品", "调料", "饮品", "零食", "其他"].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">数量</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <input 
                      type="number" 
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      placeholder="数量" 
                      className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">单位</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <select 
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium appearance-none"
                    >
                      {["克", "千克", "个", "ml", "L"].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">预期存放天数</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                    <input 
                      type="number" 
                      value={formData.expiryDays}
                      onChange={(e) => setFormData({...formData, expiryDays: e.target.value})}
                      placeholder="天数" 
                      className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 pl-11 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">购买日期</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
                    className="w-full bg-white border border-zinc-100 rounded-xl py-2.5 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </form>
            </div>

            {/* 固定底部按钮 */}
            <div className="flex-shrink-0 px-8 pt-4 pb-6 bg-surface border-t border-zinc-100">
            <button 
              onClick={handleSubmit}
              disabled={submitting || !formData.name || !formData.amount}
              className={cn(
                "w-full bg-primary text-white shadow-md shadow-primary/30 py-3.5 rounded-full font-bold shadow-xl active:scale-95 transition-all",
                (submitting || !formData.name || !formData.amount) && "opacity-50 cursor-not-allowed"
              )}
            >
              {submitting ? "添加中..." : "确认添加"}
            </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 自定义选择图片来源 Bottom Sheet */}
      <AnimatePresence>
        {showImageSourcePicker && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageSourcePicker(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full bg-surface pb-safe rounded-t-3xl overflow-hidden shadow-2xl pb-8"
            >
              <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mt-4 mb-6" />
              <div className="px-6 space-y-3">
                <button
                  type="button"
                  onClick={() => handleAiFill("camera_capture")}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-100 py-4 rounded-2xl font-bold text-zinc-900 active:bg-zinc-50 transition-colors"
                >
                  <Camera size={20} />
                  拍摄照片
                </button>
                <button
                  type="button"
                  onClick={() => handleAiFill("camera_photos")}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-100 py-4 rounded-2xl font-bold text-zinc-900 active:bg-zinc-50 transition-colors"
                >
                  <ImageIcon size={20} />
                  从相册选择
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageSourcePicker(false)}
                  className="w-full py-4 mt-2 font-bold text-zinc-400 active:text-zinc-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
