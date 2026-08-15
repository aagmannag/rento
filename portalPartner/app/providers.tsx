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
    // A 503 (see /api/auth/me's own doc comment) means a transient DB error, not a
    // logout — leave the currently-displayed owner alone rather than clobbering it with
    // a failed parse of a non-JSON error body.
    if (!res.ok) return;
    const data: { owner: ShopOwner | null } = await res.json();
    setOwner(data.owner);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Same reasoning as refreshOwner above, but for the initial mount check: a 503
    // doesn't mean this owner is logged out (the JWT signature already proved the
    // session is genuine), just that we couldn't confirm their profile right now.
    // Retry a couple of times — observed live during testing, a transient Neon
    // connection blip landing on exactly this request would otherwise force an
    // unnecessary logout.
    async function checkSession() {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data: { owner: ShopOwner | null } = await res.json();
            if (!cancelled) setOwner(data.owner);
            return;
          }
        } catch {
          // Network error — fall through to retry below.
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      // Every attempt failed — the layout will redirect to /login, same outcome as a
      // genuine "not logged in" (the safest fallback once retries are exhausted).
    }

    checkSession().finally(() => {
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
