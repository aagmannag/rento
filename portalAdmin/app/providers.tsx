"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AdminUser } from "@/lib/types";

interface AdminContextValue {
  admin: AdminUser | null;
  authLoading: boolean;
  setAdmin: (admin: AdminUser | null) => void;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // A 503 from /api/auth/me (see its own doc comment) means a DB error prevented
    // confirming this admin's profile — NOT that the session is invalid, since the JWT
    // signature already proved that. Retry a couple of times before giving up, so a
    // transient connection blip (observed live during testing — Neon occasionally drops
    // a pooled connection) doesn't force an unnecessary logout.
    async function checkSession() {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data: { admin: AdminUser | null } = await res.json();
            if (!cancelled) setAdmin(data.admin);
            return;
          }
        } catch {
          // Network error — fall through to retry below.
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      // Every attempt failed — DashboardShell will redirect to /login, same outcome as
      // a genuine "not logged in" (the safest fallback once retries are exhausted).
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
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, authLoading, setAdmin, logout }), [admin, authLoading, logout]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
