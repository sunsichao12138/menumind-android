import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, RefreshCw, Clock, Plus, Check, Heart, AlertTriangle, Coffee, Compass, Star, Package } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePlan } from "../context/PlanContext";
import { useFavorites } from "../context/FavoritesContext";
import { cn } from "../lib/utils";
import { Recipe } from "../types";
import { api } from "../api/client";

interface HomePick extends Recipe {
  slot: "expiry" | "timeslot" | "discovery";
  hint: string;
}

const SLOT_CONFIG = {
  expiry: {
    label: "临期提醒",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  timeslot: {
    label: "此刻推荐",
    icon: Coffee,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  discovery: {
    label: "新发现",
    icon: Compass,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
};

const ALL_TAGS = [
  { label: "元气早餐", emoji: "🌞", slots: ["morning"] },
  { label: "低碳水", emoji: "🌿" },
  { label: "宝宝餐", emoji: "👶" },
  { label: "本周热点", emoji: "🔥" },
  { label: "15分钟快手", emoji: "⏱️", slots: ["morning", "lunch"] },
  { label: "拯救冰箱", emoji: "🧊" },
  { label: "来点甜的", emoji: "🍰", slots: ["afternoon"] },
  { label: "喝点东西", emoji: "🥤", slots: ["afternoon"] },
  { label: "家常菜", emoji: "🍳", slots: ["lunch", "dinner"] },
  { label: "西式料理", emoji: "🍝", slots: ["lunch", "dinner"] },
  { label: "日韩风味", emoji: "🍣", slots: ["lunch", "dinner"] },
  { label: "火辣过瘾", emoji: "🌶️", slots: ["lunch", "dinner", "night"] },
  { label: "清爽解腻", emoji: "🥗", slots: ["afternoon"] },
  { label: "高蛋白", emoji: "💪" },
  { label: "深夜食堂", emoji: "🌙", slots: ["night"] },
  { label: "减脂餐", emoji: "🥑", slots: ["morning", "lunch"] },
  { label: "微醺调酒", emoji: "🍸", slots: ["night"] },
];

// 根据时间获取当前时段
const getTimeSlot = (): string => {
  const h = new Date().getHours();
  if (h < 4) return "night";
  if (h < 11) return "morning";
  if (h < 14) return "lunch";
  if (h < 17) return "afternoon";
  if (h < 21) return "dinner";
  return "night";
};

// 生成时段感知的标签列表
const getTimeTags = () => {
  const slot = getTimeSlot();
  const slotTags = ALL_TAGS.filter(t => t.slots?.includes(slot));
  const generalTags = ALL_TAGS.filter(t => !t.slots);
  const otherTags = ALL_TAGS.filter(t => t.slots && !t.slots.includes(slot));

  return [
    ...slotTags.sort(() => 0.5 - Math.random()),
    ...generalTags.sort(() => 0.5 - Math.random()),
    ...otherTags.sort(() => 0.5 - Math.random()),
  ].slice(0, 6);
};

export default function Home() {
  const navigate = useNavigate();
  const { addToPlan, removeFromPlan, isInPlan } = usePlan();
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const [picks, setPicks] = useState<HomePick[]>([]);
  const [hasData, setHasData] = useState(false);

  // 加载首页推荐
  const loadHomePicks = async () => {
    try {
      const localHour = new Date().getHours();
      const data = await api.get<HomePick[]>(`/ai/home-picks?hour=${localHour}`);
      if (data && data.length > 0) {
        setPicks(data);
        setHasData(true);
        localStorage.setItem("home_picks_cache", JSON.stringify({ picks: data, ts: Date.now() }));
      }
    } catch (err) {
      console.error("Failed to load home picks:", err);
    }
  };

  // 初始化：先读缓存秒开，再异步刷新
  useEffect(() => {
    // 1. 先读缓存
    try {
      const raw = localStorage.getItem("home_picks_cache");
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.picks && cached.picks.length > 0) {
          setPicks(cached.picks);
          setHasData(true);
        }
      }
    } catch {}

    // 2. 异步刷新（不阻塞首屏）
    loadHomePicks();
  }, []);

  // 页面可见时刷新
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        loadHomePicks();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, []);

  const [currentTags, setCurrentTags] = useState(() => getTimeTags());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTags = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setCurrentTags(getTimeTags());
      setIsRefreshing(false);
    }, 500);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 4) return "夜深了，来点宵夜犒劳下自己？ ✨";
    if (hour < 11) return "早上好，来份元气早餐吧 ☀️";
    if (hour < 14) return "中午好，该吃午饭啦 🍱";
    if (hour < 17) return "下午好，该吃下午茶了 ☕️";
    if (hour < 21) return "晚上好，准备好晚餐了吗 🌙";
    return "夜深了，来点宵夜犒劳下自己？ ✨";
  };

  // Generate a pseudo-random rating based on recipe id
  const getRating = (id: string) => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (4.0 + (hash % 10) / 10).toFixed(1);
  };

  return (
    <div className="px-5 pt-10 pb-12 space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">今日推荐</h1>
        <p className="text-on-surface-variant text-sm mt-0.5 font-bold">{getGreeting()}</p>
      </section>

      {/* AI Recommendation Banner */}
      <section 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 shadow-sm px-4 py-3 cursor-pointer active:scale-[0.99] transition-transform"
        onClick={() => navigate("/filters")}
      >
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-primary" />
              <span className="text-[10px] tracking-wider uppercase font-bold text-primary/80">AI 智能推荐</span>
            </div>
            <h3 className="font-extrabold text-lg text-on-surface">今天吃什么？</h3>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); navigate("/filters"); }}
            className="bg-gradient-to-r from-primary to-orange-500 text-white font-extrabold rounded-full px-5 py-2 text-sm shadow-md shadow-primary/25 active:scale-95 transition-transform whitespace-nowrap"
          >
            帮我选
          </button>
        </div>
      </section>

      {/* Quick Tags */}
      <section>
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-sm text-on-surface">你现在更想要</h4>
          <button 
            onClick={refreshTags}
            disabled={isRefreshing}
            className={cn(
              "text-on-surface-variant hover:text-primary p-1.5 rounded-full transition-all active:scale-90",
              isRefreshing && "animate-spin"
            )}
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence mode="popLayout">
            {currentTags.map((tag) => (
              <motion.button
                key={tag.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => { localStorage.removeItem("ai_recommend_cache"); navigate(`/filters?quick=true&tag=${tag.label}`); }}
                className={cn(
                  "py-2 px-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 truncate",
                  (tag as any).special
                    ? "bg-primary text-white shadow-md shadow-primary/25 border border-primary"
                    : "bg-white text-on-surface border border-orange-100/80 editorial-shadow hover:bg-orange-50/50"
                )}
              >
                <span className="text-sm">{tag.emoji}</span>
                <span className="truncate">{tag.label}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Recipe Cards — 2 Column Grid */}
      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-sm text-on-surface">为你精选</h4>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-primary/40" />
            </div>
            <p className="text-on-surface-variant text-sm font-semibold">正在为你准备推荐...</p>
            <p className="text-on-surface-variant/60 text-xs mt-1">添加冰箱食材后推荐更精准</p>
          </div>
        ) : (
          <div className="space-y-2">
            {picks.map((pick, index) => {
              const slotCfg = SLOT_CONFIG[pick.slot];
              const SlotIcon = slotCfg.icon;
              const rating = getRating(pick.id);
              return (
                <motion.article
                  key={pick.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.08 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/recipe/${pick.id}`)}
                  className="bg-white rounded-2xl overflow-hidden border border-orange-100/60 shadow-sm cursor-pointer hover:shadow-md transition-shadow editorial-shadow flex gap-3 p-2.5"
                >
                  {/* Left: Image */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-surface-container-low">
                    <img
                      src={pick.image}
                      alt={pick.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Right: Content */}
                  <div className="flex-grow min-w-0 flex flex-col justify-between">
                    {/* Title + Rating + Favorite */}
                    <div className="flex items-center gap-1">
                      <h5 className="text-sm font-extrabold text-on-surface truncate flex-grow">{pick.name}</h5>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-[10px] font-bold text-amber-500">{rating}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(pick);
                        }}
                        className={cn(
                          "p-0.5 rounded-full transition-all active:scale-90 flex-shrink-0",
                          isFavorite(pick.id) ? "text-red-500" : "text-zinc-300 hover:text-zinc-400"
                        )}
                      >
                        <Heart size={16} fill={isFavorite(pick.id) ? "currentColor" : "none"} />
                      </button>
                    </div>

                    {/* Hint */}
                    <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-1">
                      {pick.hint || pick.description}
                    </p>

                    {/* Slot Tag */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full border whitespace-nowrap",
                        slotCfg.color
                      )}>
                        <SlotIcon size={9} />
                        {slotCfg.label}
                      </span>
                    </div>

                    {/* Time + Inventory + Add Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-[10px] text-on-surface-variant font-medium">
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {pick.time}
                        </span>
                        {(pick.inventoryMatch ?? pick.ingredients?.have?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Package size={10} />
                            {pick.inventoryMatch ?? pick.ingredients?.have?.length}种食材
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isInPlan(pick.id)) {
                            removeFromPlan(pick.id);
                          } else {
                            addToPlan(pick);
                          }
                        }}
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center rounded-full w-7 h-7 transition-all active:scale-90",
                          isInPlan(pick.id) ? "bg-surface-container-low text-on-surface-variant" : "bg-primary text-white shadow-sm shadow-primary/30"
                        )}
                      >
                        {isInPlan(pick.id) ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
