"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, CalendarCheck, LogIn, Menu, X, User as UserIcon } from "lucide-react";
import { useApp } from "@/app/providers";

export default function Nav() {
  const router = useRouter();
  const { user, openLoginModal } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between py-3 sm:py-0">
          <Link href="/" className="flex items-center gap-2 py-2">
            <span className="text-lg font-800 tracking-tight text-primary sm:text-xl">Rento</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/#cities"
              className="flex items-center gap-1.5 text-sm font-600 text-foreground transition-colors duration-150 hover:text-primary"
            >
              <Car size={17} />
              Find Vehicles
            </Link>
            <Link
              href="/my-bookings"
              className="flex items-center gap-1.5 text-sm font-600 text-foreground transition-colors duration-150 hover:text-primary"
            >
              <CalendarCheck size={17} />
              My Bookings
            </Link>

            {user?.isLoggedIn ? (
              <button
                onClick={() => router.push("/profile")}
                className="flex min-h-11 items-center gap-2 rounded-full border border-border py-1.5 pl-1.5 pr-3 text-sm font-600 text-foreground transition hover:border-primary"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-700 text-primary-foreground">
                  {user.name.charAt(0)}
                </span>
                {user.name.split(" ")[0]}
              </button>
            ) : (
              <button onClick={openLoginModal} className="btn-primary flex items-center gap-2 text-sm">
                <LogIn size={16} />
                Login / Sign Up
              </button>
            )}
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition hover:bg-muted md:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="flex flex-col gap-1 border-t border-border py-3 md:hidden">
            <Link
              href="/#cities"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-600 text-foreground hover:bg-muted"
            >
              <Car size={17} /> Find Vehicles
            </Link>
            <Link
              href="/my-bookings"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-600 text-foreground hover:bg-muted"
            >
              <CalendarCheck size={17} /> My Bookings
            </Link>
            {user?.isLoggedIn ? (
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-600 text-foreground hover:bg-muted"
              >
                <UserIcon size={17} /> Profile
              </Link>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  openLoginModal();
                }}
                className="btn-primary mt-1 flex items-center justify-center gap-2 text-sm"
              >
                <LogIn size={16} /> Login / Sign Up
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
