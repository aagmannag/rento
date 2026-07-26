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
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { admin: AdminUser | null }) => {
        if (!cancelled) setAdmin(data.admin);
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
