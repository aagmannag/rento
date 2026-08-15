"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CITIES, isCityLive } from "@/lib/data";
import { useApp } from "@/app/providers";
import type { City } from "@/lib/types";

export default function Footer() {
  const router = useRouter();
  const { setSelectedCity } = useApp();
  const midpoint = Math.ceil(CITIES.length / 2);
  const leftCities = CITIES.slice(0, midpoint);
  const rightCities = CITIES.slice(midpoint);

  function handleCityClick(city: City) {
    setSelectedCity(city);
    router.push(isCityLive(city) ? "/category" : `/coming-soon?city=${encodeURIComponent(city)}`);
  }

  const sectionTitleClass = "text-sm font-700 uppercase tracking-wider text-white/80";
  const linkListClass = "mt-3 space-y-0.5 text-sm text-white/60";
  const linkClass = "inline-flex min-h-10 items-center py-1 hover:text-white sm:min-h-11";

  return (
    <footer className="bg-foreground py-10 text-white sm:py-12">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:gap-y-10 lg:grid-cols-4 lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <p className="text-lg font-800 sm:text-xl">Rento</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-white/60 lg:max-w-none">
              India&apos;s most convenient vehicle rental platform — bikes, scooties, and cars,
              expanding across {CITIES.length} cities.
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <p className={sectionTitleClass}>Cities</p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 text-sm text-white/60 sm:hidden">
              <ul className="space-y-0.5">
                {leftCities.map((city) => (
                  <li key={city}>
                    <button
                      onClick={() => handleCityClick(city)}
                      className="flex min-h-10 items-center gap-2 py-1 text-left hover:text-white"
                    >
                      {city}
                      {!isCityLive(city) && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-700 text-white/70">
                          Soon
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="space-y-0.5">
                {rightCities.map((city) => (
                  <li key={city}>
                    <button
                      onClick={() => handleCityClick(city)}
                      className="flex min-h-10 items-center gap-2 py-1 text-left hover:text-white"
                    >
                      {city}
                      {!isCityLive(city) && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-700 text-white/70">
                          Soon
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <ul className={`${linkListClass} hidden sm:block`}>
              {CITIES.map((city) => (
                <li key={city}>
                  <button
                    onClick={() => handleCityClick(city)}
                    className="flex min-h-10 items-center gap-2 py-1 text-left hover:text-white sm:min-h-11"
                  >
                    {city}
                    {!isCityLive(city) && (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-700 text-white/70">
                        Soon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Company</p>
            <ul className={linkListClass}>
              {/* prefetch={false}: these are low-traffic informational pages that render
                  in the footer of every page on the site. Next.js's default Link
                  prefetching loads a route's code + data as soon as it scrolls into
                  view — with 8 such links in one footer, that meant every page load
                  quietly triggered up to 8 background route loads (each its own
                  on-demand dev compile, each its own DB round trip) competing with the
                  actual booking flow for the same connection pool. None of these pages
                  are on a critical path worth prefetching. */}
              <li><Link href="/about" prefetch={false} className={linkClass}>About Us</Link></li>
              <li><Link href="/careers" prefetch={false} className={linkClass}>Careers</Link></li>
              <li><Link href="/blog" prefetch={false} className={linkClass}>Blog</Link></li>
              <li><Link href="/press" prefetch={false} className={linkClass}>Press</Link></li>
            </ul>
          </div>

          <div>
            <p className={sectionTitleClass}>Support</p>
            <ul className={linkListClass}>
              <li><Link href="/help" prefetch={false} className={linkClass}>Help Center</Link></li>
              <li><Link href="/cancellation-policy" prefetch={false} className={linkClass}>Cancellation Policy</Link></li>
              <li><Link href="/contact" prefetch={false} className={linkClass}>Contact Us</Link></li>
              <li><Link href="/terms" prefetch={false} className={linkClass}>Terms &amp; Privacy</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-screen-xl flex-col items-center gap-2 border-t border-white/10 px-4 pt-6 text-center text-xs text-white/50 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
        <span>© 2026 Rento Technologies Pvt. Ltd. All rights reserved.</span>
        <span>Made with ❤ in India</span>
      </div>
    </footer>
  );
}
