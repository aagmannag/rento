"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  variant: "default" | "error" | "success";
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastItem["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastItem["variant"] = "default") => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-600 text-white shadow-lg ${
              t.variant === "error" ? "bg-red-600" : t.variant === "success" ? "bg-primary" : "bg-foreground"
            }`}
          >
            {t.variant === "error" ? (
              <XCircle size={16} className="shrink-0" />
            ) : t.variant === "success" ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <Info size={16} className="shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
