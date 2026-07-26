"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Bike as BikeIcon, Car as CarIcon } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CATEGORIES, isCityLive } from "@/lib/data";
import { useApp } from "../providers";
import type { Category } from "@/lib/types";

const CATEGORY_STYLE: Record<Category, { icon: React.ElementType; iconBg: string; text: string }> = {
  Scooty: { icon: Zap, iconBg: "bg-blue-100", text: "text-blue-600" },
  Bike: { icon: BikeIcon, iconBg: "bg-orange-100", text: "text-orange-600" },
  Car: { icon: CarIcon, iconBg: "bg-green-100", text: "text-green-600" },
};

export default function CategoryPage() {
  const router = useRouter();
  const { selectedCity, setSelectedCategory } = useApp();

  useEffect(() => {
    if (!selectedCity) {
      router.replace("/");
    } else if (!isCityLive(selectedCity)) {
      router.replace(`/coming-soon?city=${encodeURIComponent(selectedCity)}`);
    }
  }, [selectedCity, router]);

  if (!selectedCity || !isCityLive(selectedCity)) return null;

  function handlePick(category: Category) {
    setSelectedCategory(category);
    router.push("/vehicles");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title={selectedCity} backHref="/" />

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">What would you like to rent in</p>
        <h2 className="text-2xl font-800 text-foreground">{selectedCity}?</h2>

        <div className="mt-6 grid max-w-xl gap-3">
          {CATEGORIES.map((cat) => {
            const style = CATEGORY_STYLE[cat.key];
            const Icon = style.icon;
            return (
              <button
                key={cat.key}
                onClick={() => handlePick(cat.key)}
                className="card-hover flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card"
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${style.iconBg} ${style.text}`}>
                  <Icon size={26} />
                </div>
                <div className="flex-1">
                  <p className="text-base font-700 text-foreground">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.blurb}</p>
                </div>
                <span className="text-muted-foreground">›</span>
              </button>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
