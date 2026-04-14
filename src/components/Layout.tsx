import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, Archive, Calendar, User } from "lucide-react";
import { cn } from "../lib/utils";

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface pb-24 max-w-md mx-auto relative shadow-2xl">
      <main>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass-nav px-6 py-3 z-50 flex justify-between items-center">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary drop-shadow-sm" : "text-zinc-400"
            )
          }
        >
          <Home size={24} />
          <span className="text-[10px] font-bold">首页</span>
        </NavLink>
        <NavLink
          to="/fridge"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary drop-shadow-sm" : "text-zinc-400"
            )
          }
        >
          <Archive size={24} />
          <span className="text-[10px] font-bold">冰箱</span>
        </NavLink>
        <NavLink
          to="/plan"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary drop-shadow-sm" : "text-zinc-400"
            )
          }
        >
          <Calendar size={24} />
          <span className="text-[10px] font-bold">计划</span>
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary drop-shadow-sm" : "text-zinc-400"
            )
          }
        >
          <User size={24} />
          <span className="text-[10px] font-bold">我的</span>
        </NavLink>
      </nav>
    </div>
  );
}
