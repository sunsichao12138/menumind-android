import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import appIcon from "../assets/app-icon.jpg";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("请填写邮箱和密码");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("密码至少需要 6 个字符");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error === "Invalid login credentials" ? "邮箱或密码错误" : error);
        } else {
          navigate("/", { replace: true });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.includes("already registered")) {
            setError("该邮箱已注册，请直接登录");
          } else {
            setError(error);
          }
        } else {
          localStorage.setItem("needsSetup", "true");
          navigate("/setup-profile", { replace: true });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl flex flex-col">
      {/* 顶部装饰 */}
      <div className="relative pt-20 pb-12 px-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 rounded-full -mr-32 -mt-32 opacity-30" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-zinc-50 rounded-full -ml-20 -mb-20 opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-3xl shadow-2xl mb-2 overflow-hidden">
            <img src={appIcon} alt="小灶" className="w-full h-full object-cover scale-[1.2]" />
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">小灶</h1>
          <p className="text-zinc-400 text-sm font-medium">AI 帮你管冰箱、挑菜谱、减浪费</p>
        </motion.div>
      </div>

      {/* 切换 Tab */}
      <div className="px-8 mb-6">
        <div className="flex bg-zinc-100 rounded-2xl p-1">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setMode(tab); setError(""); }}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300",
                mode === tab
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              {tab === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="flex-grow px-8 space-y-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* 邮箱 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-4">邮箱地址</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full bg-zinc-50 border border-zinc-100 pl-12 pr-4 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-200 transition-all"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-4">密码</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "至少 6 个字符" : "请输入密码"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-zinc-50 border border-zinc-100 pl-12 pr-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-200 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 确认密码（注册模式） */}
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-4">确认密码</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    className="w-full bg-zinc-50 border border-zinc-100 pl-12 pr-4 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-200 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-500 text-sm text-center font-medium bg-red-50 py-3 rounded-2xl"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white shadow-md shadow-primary/30 py-4 rounded-full font-bold text-base shadow-xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              {mode === "login" ? "登录" : "注册"}
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* 底部切换 */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            {mode === "login" ? "还没有账号？立即注册" : "已有账号？直接登录"}
          </button>
        </div>
      </form>

      {/* 底部 */}
      <div className="px-8 py-8">
        <p className="text-center text-[10px] text-zinc-300 leading-relaxed">
          登录即代表您同意 <span className="text-zinc-500 font-bold">服务协议</span> 和 <span className="text-zinc-500 font-bold">隐私政策</span>
        </p>
      </div>
    </div>
  );
}
