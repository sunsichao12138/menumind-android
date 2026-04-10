import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, RefreshCw, Clock, Plus, Check, Heart, AlertTriangle, Coffee, Compass } from "lucide-react";
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
  "来点甜的", "喝点东西", "快速搞定", "吃饱一点", "清库存", "低负担", 
  "家常菜", "西式料理", "日韩风味", "火辣过瘾", "清爽解腻", 
  "高蛋白", "低碳水", "深夜食堂", "元气早餐", "减脂餐", "宝宝餐", "微醺调酒"
];

export default function Home() {
  const navigate = useNavigate();
  const { addToPlan, removeFromPlan, isInPlan } = usePlan();
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const [picks, setPicks] = useState<HomePick[]>([]);
  const [hasData, setHasData] = useState(false);

  // 加载首页推荐
  const loadHomePicks = async () => {
    try {
      const data = await api.get<HomePick[]>("/ai/home-picks");
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

  const [currentTags, setCurrentTags] = useState(() => {
    return [...ALL_TAGS].sort(() => 0.5 - Math.random()).slice(0, 6);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTags = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const shuffled = [...ALL_TAGS].sort(() => 0.5 - Math.random());
      setCurrentTags(shuffled.slice(0, 6));
      setIsRefreshing(false);
    }, 500);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "早上好，来份元气早餐吧 ☀️";
    if (hour < 14) return "中午好，该吃午饭啦 🍱";
    if (hour < 17) return "下午好，该吃下午茶了 ☕️";
    if (hour < 21) return "晚上好，准备好晚餐了吗 🌙";
    return "夜深了，来点宵夜犒劳下自己？ ✨";
  };

  return (
    <div className="px-6 py-12 space-y-8 animate-in fade-in duration-500">
      <section>
        <h1 className="text-3xl font-bold text-on-surface tracking-tight">今日推荐</h1>
        <p className="text-zinc-500 text-lg mt-1 font-bold">{getGreeting()}</p>
      </section>

      <section className="relative overflow-hidden rounded-xl bg-zinc-900 text-white shadow-lg px-8 py-6">
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-2 opacity-80">
            <Sparkles size={16} className="text-primary-container" />
            <span className="text-xs tracking-wider uppercase font-bold">AI 智能推荐</span>
          </div>
          <h3 className="font-bold text-2xl">今天吃什么？</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            根据时间和你的偏好，帮你决定现在吃什么。
          </p>
          <button 
            onClick={() => navigate("/filters")}
            className="w-full bg-white text-black font-bold rounded-full py-3 transition-transform active:scale-95 hover:bg-zinc-100"
          >
            开始推荐
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zinc-800 to-transparent opacity-50 rounded-full -mr-16 -mt-16"></div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-lg">你现在更想要</h4>
          <button 
            onClick={refreshTags}
            disabled={isRefreshing}
            className={cn(
              "text-zinc-400 hover:text-zinc-600 p-2 rounded-full transition-all active:scale-90",
              isRefreshing && "animate-spin"
            )}
          >
            <RefreshCw size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {currentTags.map((tag) => (
              <motion.button
                key={tag}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => { localStorage.removeItem("ai_recommend_cache"); navigate(`/filters?quick=true&tag=${tag}`); }}
                className="py-3 px-2 border border-zinc-100 bg-white rounded-2xl text-sm font-medium hover:bg-zinc-50 active:scale-95 transition-all text-zinc-700 editorial-shadow truncate"
              >
                {tag}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center mb-1">
          <h4 className="font-bold text-lg">为你精选</h4>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Sparkles size={32} className="text-zinc-300 mb-3" />
            <p className="text-zinc-400 text-sm font-medium">正在为你准备推荐...</p>
            <p className="text-zinc-300 text-xs mt-1">添加冰箱食材后推荐更精准</p>
          </div>
        ) : (
          <div className="space-y-4">
            {picks.map((pick, index) => {
              const slotCfg = SLOT_CONFIG[pick.slot];
              const SlotIcon = slotCfg.icon;
              return (
                <motion.article
                  key={pick.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.1 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/recipe/${pick.id}`)}
                  className="p-3 bg-white border border-zinc-100 rounded-3xl shadow-sm flex items-center gap-4 cursor-pointer editorial-shadow"
                >
                  <div className="w-20 h-20 flex-shrink-0 bg-zinc-50 rounded-2xl overflow-hidden">
                    <img
                      src={pick.image}
                      alt={pick.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex flex-col mb-1">
                      <div className="flex items-center gap-2">
                        <h5 className="text-base font-bold text-zinc-900 truncate">{pick.name}</h5>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(pick);
                          }}
                          className={cn(
                            "p-1 rounded-full transition-all active:scale-90",
                            isFavorite(pick.id) ? "text-red-500" : "text-zinc-300 hover:text-zinc-400"
                          )}
                        >
                          <Heart size={14} fill={isFavorite(pick.id) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap",
                          slotCfg.color
                        )}>
                          <SlotIcon size={10} />
                          {slotCfg.label}
                        </span>
                        <p className="text-xs text-zinc-500 leading-tight truncate">{pick.hint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center text-xs text-zinc-400">
                        <Clock size={14} className="mr-1" />
                        <span>{pick.time}</span>
                      </div>
                    </div>
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
                    className={`flex-shrink-0 flex items-center justify-center rounded-full w-8 h-8 transition-all active:scale-90 ${
                      isInPlan(pick.id) ? "bg-zinc-100 text-zinc-400" : "bg-black text-white"
                    }`}
                  >
                    {isInPlan(pick.id) ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
