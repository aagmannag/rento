"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CITIES, isCityLive } from "@/lib/data";
import { useApp } from "@/app/providers";
import type { City } from "@/lib/types";

export default function Footer() {
  const router = useRouter();
  const { setSelectedCity } = useApp();

  function handleCityClick(city: City) {
    setSelectedCity(city);
    router.push(isCityLive(city) ? "/category" : `/coming-soon?city=${encodeURIComponent(city)}`);
  }

  return (
    <footer className="bg-foreground py-12 text-white">
      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="text-lg font-800 sm:text-xl">Rento</p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            India&apos;s most convenient vehicle rental platform — bikes, scooties, and cars,
            expanding across {CITIES.length} cities.
          </p>
        </div>

        <div>
          <p className="text-sm font-700 uppercase tracking-wider text-white/80">Cities</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            {CITIES.map((city) => (
              <li key={city}>
                <button
                  onClick={() => handleCityClick(city)}
                  className="flex min-h-11 items-center gap-2 py-1 text-left hover:text-white"
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
          <p className="text-sm font-700 uppercase tracking-wider text-white/80">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><Link href="/about" className="inline-flex min-h-11 items-center hover:text-white">About Us</Link></li>
            <li><Link href="/careers" className="inline-flex min-h-11 items-center hover:text-white">Careers</Link></li>
            <li><Link href="/blog" className="inline-flex min-h-11 items-center hover:text-white">Blog</Link></li>
            <li><Link href="/press" className="inline-flex min-h-11 items-center hover:text-white">Press</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-700 uppercase tracking-wider text-white/80">Support</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><Link href="/help" className="inline-flex min-h-11 items-center hover:text-white">Help Center</Link></li>
            <li><Link href="/cancellation-policy" className="inline-flex min-h-11 items-center hover:text-white">Cancellation Policy</Link></li>
            <li><Link href="/contact" className="inline-flex min-h-11 items-center hover:text-white">Contact Us</Link></li>
            <li><Link href="/terms" className="inline-flex min-h-11 items-center hover:text-white">Terms &amp; Privacy</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-screen-xl flex-col items-center gap-2 border-t border-white/10 px-4 pt-6 text-xs text-white/50 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span>© 2026 Rento Technologies Pvt. Ltd. All rights reserved.</span>
        <span>Made with ❤ in India</span>
      </div>
    </footer>
  );
}
