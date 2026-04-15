import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Users, UserPlus } from "lucide-react";
import { cn } from "../lib/utils";
import { useFamily } from "../context/FamilyContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FamilyModal({ isOpen, onClose }: Props) {
  const { createFamily, joinFamily, getFamilyDetail, refreshFamilies } = useFamily();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [newName, setNewName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const f = await createFamily(newName.trim());
      setSuccess(`家庭「${f.name}」创建成功！`);
      setNewName("");
      setTimeout(() => { setSuccess(""); onClose(); }, 1500);
    } catch (err: any) {
      setError(err.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await joinFamily(joinId.trim());
      setSuccess(`已成功加入家庭「${result.familyName}」！`);
      setJoinId("");
      setTimeout(() => { setSuccess(""); onClose(); }, 1500);
    } catch (err: any) {
      setError(err.message || "加入失败，请检查ID");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white w-full max-w-sm rounded-3xl p-7 shadow-2xl space-y-5"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-1 pt-1">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={24} className="text-primary" />
              </div>
              <h3 className="text-xl font-black text-zinc-900">家庭厨房</h3>
              <p className="text-zinc-400 text-xs">创建或加入家庭，共享冰箱和计划</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-bold px-4 py-2.5 rounded-xl text-center">{error}</div>
            )}
            {success && (
              <div className="bg-green-50 text-green-600 text-sm font-bold px-4 py-2.5 rounded-xl text-center">{success}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setTab("create"); setError(""); }}
                className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", tab === "create" ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500")}
              >
                创建家庭
              </button>
              <button
                onClick={() => { setTab("join"); setError(""); }}
                className={cn("flex-1 py-2.5 rounded-full text-sm font-bold transition-all", tab === "join" ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500")}
              >
                加入家庭
              </button>
            </div>

            {tab === "create" && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="输入家庭名称，如：温馨小家"
                  maxLength={20}
                  className="w-full bg-zinc-50 border border-zinc-100 px-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
                <button
                  onClick={handleCreate}
                  disabled={loading || !newName.trim()}
                  className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-40"
                >
                  {loading ? "创建中..." : "创建家庭"}
                </button>
              </div>
            )}

            {tab === "join" && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={joinId}
                  onChange={e => setJoinId(e.target.value)}
                  placeholder="粘贴家庭ID"
                  className="w-full bg-zinc-50 border border-zinc-100 px-4 py-3.5 rounded-2xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                />
                <button
                  onClick={handleJoin}
                  disabled={loading || !joinId.trim()}
                  className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-40"
                >
                  {loading ? "加入中..." : "加入家庭"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
