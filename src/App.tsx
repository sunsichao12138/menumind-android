import React, { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Fridge from "./pages/Fridge";
import Filters from "./pages/Filters";
import DishDetail from "./pages/DishDetail";
import Plan from "./pages/Plan";
import AllDishes from "./pages/AllDishes";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import SetupProfile from "./pages/SetupProfile";
import { PlanProvider } from "./context/PlanContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { HistoryProvider } from "./context/HistoryContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FamilyProvider } from "./context/FamilyContext";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-medium">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Data providers wrapped in auth check - only fetch data when logged in
function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <FamilyProvider>
      <HistoryProvider>
        <FavoritesProvider>
          <PlanProvider>
            {children}
          </PlanProvider>
        </FavoritesProvider>
      </HistoryProvider>
    </FamilyProvider>
  );
}

// Android 返回键处理
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          // 如果在首页，最小化应用而不是退出
          if (location.pathname === "/" || location.pathname === "") {
            App.minimizeApp();
          } else if (canGoBack || window.history.length > 1) {
            navigate(-1);
          } else {
            App.minimizeApp();
          }
        });
        cleanup = () => handle.remove();
      } catch {
        // 非 Capacitor 环境忽略
      }
    };

    setup();
    return () => cleanup?.();
  }, [navigate, location.pathname]);

  return null;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/auth" element={user ? <Navigate to={localStorage.getItem("needsSetup") === "true" ? "/setup-profile" : "/"} replace /> : <Auth />} />

      {/* 首次设置资料 */}
      <Route path="/setup-profile" element={
        <ProtectedRoute>
          <AuthenticatedProviders>
            <SetupProfile />
          </AuthenticatedProviders>
        </ProtectedRoute>
      } />

      {/* 受保护的路由 - 数据 providers 只在登录后加载 */}
      <Route path="/" element={
        <ProtectedRoute>
          <AuthenticatedProviders>
            <Layout />
          </AuthenticatedProviders>
        </ProtectedRoute>
      }>
        <Route index element={<Home />} />
        <Route path="fridge" element={<Fridge />} />
        <Route path="plan" element={<Plan />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/filters" element={
        <ProtectedRoute>
          <AuthenticatedProviders>
            <Filters />
          </AuthenticatedProviders>
        </ProtectedRoute>
      } />
      <Route path="/recipe/:id" element={
        <ProtectedRoute>
          <AuthenticatedProviders>
            <DishDetail />
          </AuthenticatedProviders>
        </ProtectedRoute>
      } />
      <Route path="/all-dishes" element={
        <ProtectedRoute>
          <AuthenticatedProviders>
            <AllDishes />
          </AuthenticatedProviders>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <BackButtonHandler />
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
