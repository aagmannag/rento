"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAdmin } from "@/app/providers";
import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { admin, authLoading } = useAdmin();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.replace("/login");
    }
  }, [authLoading, admin, router]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (authLoading || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm font-600">Loading admin console…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="fixed h-screen w-64">
          <Sidebar />
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          >
            <Menu size={20} />
          </button>
          <span className="text-xl font-800 tracking-tight text-primary">Rento</span>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-screen-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
