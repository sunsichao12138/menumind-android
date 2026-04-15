import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  History, 
  Settings, 
  Users, 
  ChevronRight, 
  LogOut, 
  ShieldCheck, 
  Bell, 
  HelpCircle,
  Camera,
  X,
  Smartphone,
  Mail,
  Github
} from "lucide-react";
import { cn } from "../lib/utils";
import { useFavorites } from "../context/FavoritesContext";
import { useHistory } from "../context/HistoryContext";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";

interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  points: number;
  restrictions: string[];
  tastePreferences: string[];
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const [showPreferences, setShowPreferences] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [selectedTastes, setSelectedTastes] = useState<string[]>([]);
  const { favorites } = useFavorites();
  const { history, clearHistory } = useHistory();
  const navigate = useNavigate();
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const { families, createFamily, joinFamily, leaveFamily, getFamilyDetail, refreshFamilies } = useFamily();
  const [showFamily, setShowFamily] = useState(false);
  const [familyDetail, setFamilyDetail] = useState<any>(null);
  const [familyTab, setFamilyTab] = useState<"info" | "create" | "join">("info");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [joinFamilyId, setJoinFamilyId] = useState("");
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState("");

  // 从 API 加载用户配置
  useEffect(() => {
    api.get<UserProfile>("/profile")
      .then((data) => {
        setProfile(data);
        setSelectedRestrictions(data.restrictions || []);
        setSelectedTastes(data.tastePreferences || []);
      })
      .catch((err) => console.error("Failed to load profile:", err));
  }, []);

  const toggleRestriction = (item: string) => {
    setSelectedRestrictions(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const toggleTaste = (item: string) => {
    setSelectedTastes(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const savePreferences = () => {
    api.patch("/profile", {
      restrictions: selectedRestrictions,
      tastePreferences: selectedTastes,
    })
    .then((data: any) => {
      setProfile(data);
      setShowPreferences(false);
    })
    .catch((err) => console.error("Failed to save preferences:", err));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    // 压缩并转为 base64
    const canvas = document.createElement("canvas");
    const maxSize = 200;
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = async () => {
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      try {
        const updated: any = await api.patch("/profile", { avatarUrl: dataUrl });
        setProfile(updated);
      } catch (err) {
        console.error("Failed to update avatar:", err);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleSaveName = async () => {
    if (!editingName.trim()) return;
    try {
      const updated: any = await api.patch("/profile", { displayName: editingName.trim() });
      setProfile(updated);
      setShowEditName(false);
    } catch (err) {
      console.error("Failed to update name:", err);
    }
  };

  const menuItems = [
    { id: 'family', icon: <Users size={20} />, label: "我的家庭", color: "text-blue-500", bg: "bg-blue-50" },
    { id: 'prefs', icon: <Settings size={20} />, label: "偏好设置", color: "text-zinc-500", bg: "bg-zinc-50" },
    { id: 'notifs', icon: <Bell size={20} />, label: "消息通知", color: "text-orange-500", bg: "bg-orange-50" },
    { id: 'security', icon: <ShieldCheck size={20} />, label: "账号安全", color: "text-green-500", bg: "bg-green-50" },
    { id: 'help', icon: <HelpCircle size={20} />, label: "帮助与反馈", color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-28 animate-in fade-in duration-500">
      {/* Header Section */}
      <header className="bg-white px-6 pt-12 pb-8 rounded-b-[3rem] shadow-sm border-b border-zinc-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-50 rounded-full -mr-20 -mt-20 opacity-50" />
        
        <div className="relative flex items-center gap-6">
          <div className="relative group flex-shrink-0">
            <button 
              onClick={() => avatarInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-zinc-100 border-4 border-white shadow-xl overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img 
                src={profile?.avatarUrl || "https://api.dicebear.com/9.x/avataaars/svg?seed=chef1&backgroundColor=b6e3f4"} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </button>
            <button 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary text-white shadow-md shadow-primary/30 rounded-full flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition-transform"
            >
              <Camera size={12} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-grow">
            <div className="space-y-0.5">
              <button 
                onClick={() => { setEditingName(profile?.displayName || ""); setShowEditName(true); }}
                className="text-xl font-extrabold text-zinc-900 tracking-tight hover:text-zinc-600 transition-colors cursor-pointer text-left flex items-center gap-1.5"
              >
                {profile?.displayName || user?.email?.split('@')[0] || '美食探险家'}
                <span className="text-zinc-300 text-xs">✎</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary text-white shadow-md shadow-primary/20 text-[9px] font-black rounded italic">Lv.{profile?.level || 5}</span>
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">{profile?.points || 1280} 积分</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 mt-4 relative z-10 space-y-4">
        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-4">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFavorites(true)}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 flex flex-col items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Heart size={24} fill="currentColor" />
            </div>
            <div className="text-center">
              <span className="block text-xl font-black text-zinc-900">{favorites.length}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">我的收藏</span>
            </div>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowHistory(true)}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 flex flex-col items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform">
              <History size={24} />
            </div>
            <div className="text-center">
              <span className="block text-xl font-black text-zinc-900">{history.length}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">历史记录</span>
            </div>
          </motion.button>
        </section>

        {/* Menu List */}
        <section className="bg-white rounded-[2.5rem] p-2 shadow-sm border border-zinc-100 overflow-hidden">
          {menuItems.map((item, index) => (
            <button 
              key={item.id}
              onClick={() => {
                if (item.id === 'prefs') setShowPreferences(true);
                if (item.id === 'family') {
                  setShowFamily(true);
                  setFamilyError("");
                  if (families.length > 0) {
                    setFamilyTab("info");
                    getFamilyDetail(families[0].id).then(setFamilyDetail).catch(console.error);
                  } else {
                    setFamilyTab("create");
                    setFamilyDetail(null);
                  }
                }
              }}
              className={cn(
                "w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors group",
                index !== menuItems.length - 1 && "border-b border-zinc-50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", item.bg, item.color)}>
                  {item.icon}
                </div>
                <span className="font-bold text-zinc-700">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </section>

        {/* Logout Button */}
          <button 
            onClick={async () => {
              await signOut();
              navigate("/auth", { replace: true });
            }}
            className="w-full flex items-center justify-center gap-2 py-5 text-red-500 font-bold text-sm hover:bg-red-50 rounded-[2rem] transition-colors border border-zinc-100 bg-white"
          >
            <LogOut size={18} />
            退出登录
          </button>

        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Kitchen AI v1.0.4</p>
        </div>
      </main>

      {/* Preferences Modal */}
      <AnimatePresence>
        {showPreferences && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreferences(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl space-y-8 overflow-hidden"
            >
              <button 
                onClick={() => setShowPreferences(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black text-zinc-900">偏好设置</h2>
                  <p className="text-zinc-400 text-sm">定制您的专属口味和饮食习惯</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">忌口设置</h3>
                    <div className="flex flex-wrap gap-2">
                      {['葱', '姜', '蒜', '香菜', '辣椒', '花椒'].map(item => (
                        <button 
                          key={item} 
                          onClick={() => toggleRestriction(item)}
                          className={cn(
                            "px-4 py-2 rounded-full border text-sm font-bold transition-all",
                            selectedRestrictions.includes(item) 
                              ? "bg-primary text-white shadow-md shadow-primary/30 border-black" 
                              : "border-zinc-100 text-zinc-600 hover:bg-zinc-50"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">口味偏好</h3>
                    <div className="flex flex-wrap gap-2">
                      {['清淡', '麻辣', '酸甜', '咸鲜', '浓郁'].map(item => (
                        <button 
                          key={item} 
                          onClick={() => toggleTaste(item)}
                          className={cn(
                            "px-4 py-2 rounded-full border text-sm font-bold transition-all",
                            selectedTastes.includes(item) 
                              ? "bg-primary text-white shadow-md shadow-primary/30 border-black" 
                              : "border-zinc-100 text-zinc-600 hover:bg-zinc-50"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={savePreferences}
                  className="w-full bg-primary text-white shadow-md shadow-primary/30 py-4 rounded-full font-bold text-base shadow-xl active:scale-95 transition-all"
                >
                  保存设置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Favorites Modal */}
      <AnimatePresence>
        {showFavorites && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFavorites(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl flex flex-col overflow-hidden"
            >
              <button 
                onClick={() => setShowFavorites(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-black text-zinc-900">我的收藏</h2>
                <p className="text-zinc-400 text-sm">您收藏的美味菜谱都在这里</p>
              </div>

              <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
                    <Heart size={48} className="mb-4 opacity-20" />
                    <p className="font-bold">暂无收藏菜谱</p>
                  </div>
                ) : (
                  favorites.map((recipe) => (
                    <motion.div 
                      key={recipe.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => navigate(`/recipe/${recipe.id}`)}
                      className="flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl border border-zinc-100 active:scale-98 transition-all cursor-pointer group"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-bold text-zinc-900 mb-1">{recipe.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{recipe.time}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-200" />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{recipe.difficulty}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
                {history.length > 0 && (
                  <button 
                    onClick={clearHistory}
                    className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1.5 hover:bg-red-50 rounded-full transition-colors"
                  >
                    清空记录
                  </button>
                )}
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-black text-zinc-900">历史记录</h2>
                <p className="text-zinc-400 text-sm">您最近查看过的美味菜谱</p>
              </div>

              <div className="flex-grow overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
                    <History size={48} className="mb-4 opacity-20" />
                    <p className="font-bold">暂无历史记录</p>
                  </div>
                ) : (
                  history.map((recipe) => (
                    <motion.div 
                      key={recipe.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => navigate(`/recipe/${recipe.id}`)}
                      className="flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl border border-zinc-100 active:scale-98 transition-all cursor-pointer group"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-bold text-zinc-900 mb-1">{recipe.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{recipe.time}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-200" />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{recipe.difficulty}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 编辑用户名弹窗 */}
      <AnimatePresence>
        {showEditName && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditName(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-zinc-900">修改昵称</h3>
                <p className="text-zinc-400 text-xs">给自己取一个好听的名字吧</p>
              </div>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="输入新昵称"
                maxLength={20}
                autoFocus
                className="w-full bg-zinc-50 border border-zinc-100 px-5 py-4 rounded-2xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditName(false)}
                  className="flex-1 py-3 rounded-full border border-zinc-200 text-zinc-500 font-bold text-sm active:scale-95 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveName}
                  disabled={!editingName.trim()}
                  className="flex-1 py-3 rounded-full bg-primary text-white shadow-md shadow-primary/30 font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 我的家庭 Modal */}
      <AnimatePresence>
        {showFamily && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFamily(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl space-y-6 overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowFamily(false)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-zinc-900">我的家庭</h2>
                <p className="text-zinc-400 text-sm">管理您的家庭，共享冰箱和计划</p>
              </div>

              {familyError && (
                <div className="bg-red-50 text-red-600 text-sm font-bold px-4 py-3 rounded-2xl text-center">{familyError}</div>
              )}

              {/* 已有家庭 - 显示详情 */}
              {families.length > 0 && familyTab === "info" && familyDetail && (
                <div className="space-y-5">
                  <div className="bg-zinc-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">{familyDetail.name}</h3>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {familyDetail.ownerId === user?.id ? "创建者" : "成员"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 font-medium">家庭ID：</span>
                      <code className="text-xs bg-white px-2 py-1 rounded-lg border border-zinc-100 font-mono flex-1 truncate">{familyDetail.id}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(familyDetail.id);
                          setFamilyError("已复制家庭ID");
                          setTimeout(() => setFamilyError(""), 2000);
                        }}
                        className="text-xs text-primary font-bold px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">家庭成员 ({familyDetail.members?.length || 0})</h4>
                    <div className="space-y-2">
                      {(familyDetail.members || []).map((m: any) => (
                        <div key={m.userId} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                          <img
                            src={m.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${m.userId}&backgroundColor=b6e3f4`}
                            alt={m.displayName}
                            className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-sm text-zinc-800">{m.displayName}</span>
                            {m.role === "owner" && (
                              <span className="ml-2 text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-black">创建者</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setFamilyLoading(true);
                      try {
                        await leaveFamily(familyDetail.id);
                        setFamilyDetail(null);
                        setFamilyTab("create");
                        await refreshFamilies();
                      } catch (err: any) {
                        setFamilyError(err.message || "操作失败");
                      } finally {
                        setFamilyLoading(false);
                      }
                    }}
                    disabled={familyLoading}
                    className="w-full py-3 rounded-full border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 active:scale-95 transition-all"
                  >
                    {familyDetail.ownerId === user?.id ? "解散家庭" : "退出家庭"}
                  </button>
                </div>
              )}

              {/* 未加入家庭 - 创建或加入 */}
              {(families.length === 0 || familyTab !== "info") && familyTab !== "info" && (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFamilyTab("create")}
                      className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", familyTab === "create" ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500")}
                    >
                      创建家庭
                    </button>
                    <button
                      onClick={() => setFamilyTab("join")}
                      className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", familyTab === "join" ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500")}
                    >
                      加入家庭
                    </button>
                  </div>

                  {familyTab === "create" && (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={newFamilyName}
                        onChange={e => setNewFamilyName(e.target.value)}
                        placeholder="输入家庭名称，如：温馨小家"
                        maxLength={20}
                        className="w-full bg-zinc-50 border border-zinc-100 px-5 py-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        onClick={async () => {
                          if (!newFamilyName.trim()) return;
                          setFamilyLoading(true);
                          setFamilyError("");
                          try {
                            const f = await createFamily(newFamilyName.trim());
                            const detail = await getFamilyDetail(f.id);
                            setFamilyDetail(detail);
                            setFamilyTab("info");
                            setNewFamilyName("");
                          } catch (err: any) {
                            setFamilyError(err.message || "创建失败");
                          } finally {
                            setFamilyLoading(false);
                          }
                        }}
                        disabled={familyLoading || !newFamilyName.trim()}
                        className="w-full py-4 rounded-full bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-40"
                      >
                        {familyLoading ? "创建中..." : "创建家庭"}
                      </button>
                    </div>
                  )}

                  {familyTab === "join" && (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={joinFamilyId}
                        onChange={e => setJoinFamilyId(e.target.value)}
                        placeholder="输入家庭ID"
                        className="w-full bg-zinc-50 border border-zinc-100 px-5 py-4 rounded-2xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        onClick={async () => {
                          if (!joinFamilyId.trim()) return;
                          setFamilyLoading(true);
                          setFamilyError("");
                          try {
                            await joinFamily(joinFamilyId.trim());
                            const detail = await getFamilyDetail(joinFamilyId.trim());
                            setFamilyDetail(detail);
                            setFamilyTab("info");
                            setJoinFamilyId("");
                          } catch (err: any) {
                            setFamilyError(err.message || "加入失败，请检查ID");
                          } finally {
                            setFamilyLoading(false);
                          }
                        }}
                        disabled={familyLoading || !joinFamilyId.trim()}
                        className="w-full py-4 rounded-full bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-40"
                      >
                        {familyLoading ? "加入中..." : "加入家庭"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
