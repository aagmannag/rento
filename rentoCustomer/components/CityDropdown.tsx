"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, MapPin, ChevronDown } from "lucide-react";
import { CITIES, CITY_META, isCityLive } from "@/lib/data";
import type { City } from "@/lib/types";

export default function CityDropdown({
  value,
  onChange,
}: {
  value: City | null;
  onChange: (city: City) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Always reopen compact — showing just the live cities — rather than remembering
  // the expanded "coming soon" state from the last time it was open.
  useEffect(() => {
    if (!open) setShowComingSoon(false);
  }, [open]);

  const liveCities = CITIES.filter(isCityLive);
  const comingSoonCities = CITIES.filter((c) => !isCityLive(c));

  function handleSelect(city: City) {
    onChange(city);
    setOpen(false);
  }

  function renderRow(city: City) {
    const selected = value === city;
    return (
      <button
        key={city}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => handleSelect(city)}
        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-600 transition-colors hover:bg-muted ${
          selected ? "bg-secondary text-primary" : "text-foreground"
        }`}
      >
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
          <Image src={CITY_META[city].image} alt="" fill sizes="32px" className="object-cover" />
        </span>
        <span className="flex-1 truncate">{city}</span>
        {selected ? (
          <Check size={16} className="shrink-0 text-primary" />
        ) : !isCityLive(city) ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-700 text-muted-foreground">
            Soon
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-xl bg-white px-4 py-3.5 text-left shadow-lg ring-1 ring-black/5 transition ${
          open ? "ring-2 ring-primary/50" : ""
        }`}
      >
        <MapPin size={18} className="shrink-0 text-primary" />
        <span className={`flex-1 truncate text-sm font-600 ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value ?? "Select a city"}
        </span>
        {value && (
          <span
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-700 sm:inline-flex ${
              isCityLive(value) ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {isCityLive(value) ? "Live" : "Soon"}
          </span>
        )}
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        role="listbox"
        className={`absolute left-0 right-0 top-full z-20 mt-2 origin-top rounded-2xl bg-white shadow-xl ring-1 ring-black/5 transition-all duration-150 ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="max-h-96 overflow-y-auto py-1.5">
          <p className="px-3.5 pb-1 pt-2 text-[10px] font-700 uppercase tracking-wider text-muted-foreground">
            Live now
          </p>
          {liveCities.map(renderRow)}

          <div className="mt-1.5 border-t border-border pt-1.5">
            <button
              type="button"
              onClick={() => setShowComingSoon((s) => !s)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-700 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Coming soon · {comingSoonCities.length} cities</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform duration-200 ${showComingSoon ? "rotate-180" : ""}`}
              />
            </button>
            {showComingSoon && comingSoonCities.map(renderRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
