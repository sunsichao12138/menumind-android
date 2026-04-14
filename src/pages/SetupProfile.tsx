import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { Camera, ChefHat, ArrowRight, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { cn } from "../lib/utils";

const DEFAULT_AVATARS = [
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef2&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef3&backgroundColor=d1d4f9",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef4&backgroundColor=ffd5dc",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef5&backgroundColor=ffdfbf",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=chef6&backgroundColor=c1f0c1",
];

function resizeImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d")!;
        // 居中裁剪为正方形
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SetupProfile() {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATARS[0]);
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await resizeImage(file);
      setAvatarUrl(dataUrl);
      setIsCustomAvatar(true);
    } catch (err) {
      console.error("Failed to process image:", err);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      await api.patch("/profile", {
        displayName: displayName.trim(),
        avatarUrl,
      });
      localStorage.removeItem("needsSetup");
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl flex flex-col">
      {/* 头部 */}
      <div className="relative pt-16 pb-8 px-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 rounded-full -mr-32 -mt-32 opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center space-y-3"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl shadow-xl">
            <ChefHat size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">设置你的资料</h1>
          <p className="text-zinc-400 text-sm">让我们认识你，完善个人信息</p>
        </motion.div>
      </div>

      {/* 头像选择 */}
      <div className="px-8 space-y-4">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">选择头像</label>
        
        {/* 当前选中头像预览 */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="relative group"
          >
            <div className="w-28 h-28 rounded-full bg-zinc-100 border-4 border-white shadow-2xl overflow-hidden">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-9 h-9 bg-primary text-white shadow-md shadow-primary/30 rounded-full flex items-center justify-center shadow-lg border-3 border-white active:scale-90 transition-transform"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </motion.div>
        </div>

        {/* 预设头像列表 */}
        <div className="flex justify-center gap-3 flex-wrap">
          {DEFAULT_AVATARS.map((url, i) => (
            <button
              key={i}
              onClick={() => { setAvatarUrl(url); setIsCustomAvatar(false); }}
              className={cn(
                "w-12 h-12 rounded-full overflow-hidden border-3 transition-all",
                avatarUrl === url && !isCustomAvatar
                  ? "border-black shadow-lg scale-110"
                  : "border-zinc-200 hover:border-zinc-400 opacity-70 hover:opacity-100"
              )}
            >
              <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* 用户名输入 */}
      <div className="px-8 mt-8 space-y-2">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-4">你的昵称</label>
        <div className="relative">
          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="输入你喜欢的昵称"
            maxLength={20}
            className="w-full bg-zinc-50 border border-zinc-100 pl-12 pr-4 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-200 transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-300 font-bold">
            {displayName.length}/20
          </span>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="px-8 mt-auto pb-12 pt-8">
        <button
          onClick={handleSave}
          disabled={!displayName.trim() || isSaving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white shadow-md shadow-primary/30 py-4 rounded-full font-bold text-base shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              开始烹饪之旅
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
