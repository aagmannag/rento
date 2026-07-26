"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Zap, Bike as BikeIcon, Car as CarIcon } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { CITIES, isCityLive } from "@/lib/data";
import { useApp } from "../providers";
import type { Category } from "@/lib/types";

type SortKey = "popular" | "price-asc" | "price-desc" | "rating-desc";

const TABS: { key: Category; label: string; icon: React.ElementType }[] = [
  { key: "Scooty", label: "Scooty", icon: Zap },
  { key: "Bike", label: "Bike", icon: BikeIcon },
  { key: "Car", label: "Car", icon: CarIcon },
];

export default function VehicleListPage() {
  const router = useRouter();
  const {
    selectedCity,
    selectedCategory,
    setSelectedCategory,
    setSelectedCity,
    getAvailableStock,
    getVehiclesFor,
  } = useApp();
  const [sort, setSort] = useState<SortKey>("popular");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => {
    if (!selectedCity) {
      router.replace("/");
    } else if (!isCityLive(selectedCity)) {
      router.replace(`/coming-soon?city=${encodeURIComponent(selectedCity)}`);
    } else if (!selectedCategory) {
      router.replace("/category");
    }
  }, [selectedCity, selectedCategory, router]);

  const allInCategory = useMemo(() => {
    if (!selectedCity || !selectedCategory) return [];
    return getVehiclesFor(selectedCity, selectedCategory);
  }, [selectedCity, selectedCategory, getVehiclesFor]);

  const vehicles = useMemo(() => {
    let list = showUnavailable
      ? allInCategory
      : allInCategory.filter((v) => getAvailableStock(v) > 0);
    list = [...list];
    if (sort === "price-asc") list.sort((a, b) => a.pricePerDay - b.pricePerDay);
    if (sort === "price-desc") list.sort((a, b) => b.pricePerDay - a.pricePerDay);
    if (sort === "rating-desc") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [allInCategory, showUnavailable, sort, getAvailableStock]);

  if (!selectedCity || !isCityLive(selectedCity) || !selectedCategory) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-700 text-primary">
              <MapPin size={12} /> {selectedCity}
            </div>
            <h1 className="text-xl font-800 text-foreground">
              {selectedCategory}s in {selectedCity}
            </h1>
            <p className="text-xs text-muted-foreground">
              {allInCategory.reduce((sum, v) => sum + getAvailableStock(v), 0)} vehicles available
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setCityPickerOpen((o) => !o)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-700 text-foreground"
            >
              {selectedCity} ⌄
            </button>
            {cityPickerOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCity(city);
                      setCityPickerOpen(false);
                      router.push(isCityLive(city) ? "/category" : `/coming-soon?city=${encodeURIComponent(city)}`);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-600 transition-colors hover:bg-muted ${
                      city === selectedCity ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {city}
                    {!isCityLive(city) && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-700 text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = getVehiclesFor(selectedCity, tab.key).length;
            const availableCount = getVehiclesFor(selectedCity, tab.key).filter(
              (v) => getAvailableStock(v) > 0
            ).length;
            const active = tab.key === selectedCategory;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-600 transition ${
                  active ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-700 ${
                    active ? "bg-white/20" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {availableCount}/{count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-600 text-foreground">
            Showing <span className="font-800">{vehicles.length}</span> vehicles
          </p>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-600 text-muted-foreground">
              <span className="relative inline-flex h-5 w-9 items-center">
                <input
                  type="checkbox"
                  checked={showUnavailable}
                  onChange={(e) => setShowUnavailable(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-muted transition peer-checked:bg-primary" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
              Show unavailable
            </label>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-600 text-foreground outline-none"
            >
              <option value="popular">Most Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating-desc">Highest Rated</option>
            </select>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No {selectedCategory.toLowerCase()}s to show — try enabling &quot;Show unavailable&quot;.
          </p>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
