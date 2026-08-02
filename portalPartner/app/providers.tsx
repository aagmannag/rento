"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ShopOwner } from "@/lib/types";

interface OwnerContextValue {
  owner: ShopOwner | null;
  authLoading: boolean;
  setOwner: (owner: ShopOwner | null) => void;
  refreshOwner: () => Promise<void>;
  logout: () => Promise<void>;
}

const OwnerContext = createContext<OwnerContextValue | undefined>(undefined);

export function OwnerProvider({ children }: { children: React.ReactNode }) {
  const [owner, setOwner] = useState<ShopOwner | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshOwner = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data: { owner: ShopOwner | null } = await res.json();
    setOwner(data.owner);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { owner: ShopOwner | null }) => {
        if (!cancelled) setOwner(data.owner);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setOwner(null);
  }, []);

  const value = useMemo(
    () => ({ owner, authLoading, setOwner, refreshOwner, logout }),
    [owner, authLoading, refreshOwner, logout]
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
