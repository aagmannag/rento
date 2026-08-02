"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Store, Car, Banknote, Settings, LogOut, X } from "lucide-react";
import { useAdmin } from "@/app/providers";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/shop-owners", label: "Shop Owners", icon: Store, exact: false },
  { href: "/vehicles", label: "Vehicles", icon: Car, exact: false },
  { href: "/payments", label: "Payments", icon: Banknote, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdmin();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="text-xl font-800 tracking-tight text-primary">Rento</span>
        </Link>
        <button
          aria-label="Close menu"
          onClick={onNavigate}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sidebar-muted hover:bg-white/5 md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-600 transition ${
                active ? "bg-primary/15 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} className={active ? "text-primary" : ""} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-700 text-white">
            {admin?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-700 text-white">{admin?.name ?? "Loading…"}</p>
            <p className="truncate text-xs text-sidebar-muted">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-600 text-sidebar-muted transition hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </div>
  );
}
