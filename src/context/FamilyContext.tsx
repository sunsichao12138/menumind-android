import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

interface FamilyMember {
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string;
  avatarUrl: string;
}

interface Family {
  id: string;
  name: string;
  ownerId: string;
  role: string;
  createdAt: string;
  members?: FamilyMember[];
}

interface FamilyContextType {
  families: Family[];
  currentFamily: Family | null;
  mode: "personal" | "family";
  loading: boolean;
  switchMode: (mode: "personal" | "family", familyId?: string) => void;
  createFamily: (name: string) => Promise<Family>;
  joinFamily: (familyId: string) => Promise<{ familyName: string }>;
  leaveFamily: (familyId: string) => Promise<void>;
  refreshFamilies: () => Promise<void>;
  getFamilyDetail: (familyId: string) => Promise<Family>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
  const [mode, setMode] = useState<"personal" | "family">("personal");
  const [loading, setLoading] = useState(false);

  const refreshFamilies = useCallback(async () => {
    try {
      const data = await api.get<Family[]>("/families/mine");
      setFamilies(data);
    } catch (err) {
      console.error("Failed to load families:", err);
    }
  }, []);

  useEffect(() => {
    refreshFamilies();
  }, [refreshFamilies]);

  const switchMode = (newMode: "personal" | "family", familyId?: string) => {
    setMode(newMode);
    if (newMode === "family" && familyId) {
      const family = families.find(f => f.id === familyId);
      setCurrentFamily(family || null);
    } else {
      setCurrentFamily(null);
    }
  };

  const createFamily = async (name: string): Promise<Family> => {
    const family = await api.post<Family>("/families", { name });
    await refreshFamilies();
    return family;
  };

  const joinFamily = async (familyId: string) => {
    const result = await api.post<{ familyName: string }>(`/families/${familyId}/join`, {});
    await refreshFamilies();
    return result;
  };

  const leaveFamily = async (familyId: string) => {
    await api.delete(`/families/${familyId}/leave`);
    if (currentFamily?.id === familyId) {
      setMode("personal");
      setCurrentFamily(null);
    }
    await refreshFamilies();
  };

  const getFamilyDetail = async (familyId: string): Promise<Family> => {
    return api.get<Family>(`/families/${familyId}`);
  };

  return (
    <FamilyContext.Provider value={{
      families, currentFamily, mode, loading,
      switchMode, createFamily, joinFamily, leaveFamily,
      refreshFamilies, getFamilyDetail,
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error("useFamily must be used within a FamilyProvider");
  }
  return context;
}
