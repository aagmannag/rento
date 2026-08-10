"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Bike as BikeIcon,
  CreditCard,
  Zap,
  Car as CarIcon,
  ShieldCheck,
  Headphones,
  RotateCcw,
  Star,
  ArrowRight,
} from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CityDropdown from "@/components/CityDropdown";
import { useApp } from "./providers";
import { CITIES, CITY_META, CATEGORIES, isCityLive } from "@/lib/data";
import type { Category } from "@/lib/types";

// Shown as the advertised "starting from" price until a category has real listings —
// keeps the homepage from reading as empty before shops have onboarded in a city.
const FALLBACK_STARTING_PRICE: Record<Category, number> = {
  Scooty: 350,
  Bike: 450,
  Car: 800,
};

const CATEGORY_STYLE: Record<
  Category,
  { icon: React.ElementType; bg: string; border: string; iconBg: string; blurb: string }
> = {
  Scooty: {
    icon: Zap,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    blurb: "Lightweight & fuel-efficient. Perfect for city rides and beach hops.",
  },
  Bike: {
    icon: BikeIcon,
    bg: "bg-orange-50",
    border: "border-orange-200",
    iconBg: "bg-orange-100",
    blurb: "From commuter to adventure — find the perfect two-wheeler for your trip.",
  },
  Car: {
    icon: CarIcon,
    bg: "bg-green-50",
    border: "border-green-200",
    iconBg: "bg-green-100",
    blurb: "Comfortable sedans and SUVs for family trips and long-distance drives.",
  },
};

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: "Choose Your City",
    desc: "Live today in Lucknow & Indore, with Goa, Haridwar, Rishikesh and Bangalore launching soon.",
  },
  {
    icon: BikeIcon,
    title: "Pick Your Ride",
    desc: "Browse scooties, bikes, and cars. Filter by category, check availability, and compare prices.",
  },
  {
    icon: CreditCard,
    title: "Book & Ride",
    desc: "Pay the rental online. Collect the vehicle at the shop, pay the refundable deposit, and ride free.",
  },
];

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Verified Vehicles",
    desc: "Every vehicle inspected before listing. RC, insurance, and fitness certificates verified.",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    desc: "Our on-ground team is available round the clock. Call or WhatsApp anytime.",
  },
  {
    icon: RotateCcw,
    title: "Free Cancellation",
    desc: "Cancel up to 24 hours before pickup for a full refund. No questions asked.",
  },
  {
    icon: Star,
    title: "4.7★ Rated App",
    desc: "Over 50,000 rides completed. Trusted by travellers across India.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const {
    selectedCity,
    setSelectedCity,
    getVehicleCountForCity,
    getTotalVehicleCount,
  } = useApp();

  function handleFindVehicles() {
    if (!selectedCity) return;
    if (!isCityLive(selectedCity)) {
      router.push(`/coming-soon?city=${encodeURIComponent(selectedCity)}`);
      return;
    }
    router.push("/category");
  }

  function handleCategoryPick() {
    document.getElementById("cities")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleCityCardClick(city: (typeof CITIES)[number]) {
    setSelectedCity(city);
    if (!isCityLive(city)) {
      router.push(`/coming-soon?city=${encodeURIComponent(city)}`);
      return;
    }
    router.push("/category");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />

      {/* Hero */}
      <section className="hero-gradient relative py-10 sm:py-16 lg:py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-600 text-white backdrop-blur sm:text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live in 2 cities · expanding to 6
          </div>

          <h1 className="text-hero-xl mt-4 max-w-xl text-white sm:mt-5 sm:max-w-3xl">
            Ride on your
            <br />
            <span className="italic">own terms</span>
          </h1>

          <p className="text-hero-sub mt-3 max-w-sm text-white/90 sm:mt-4 sm:max-w-lg">
            Rent bikes, scooties &amp; cars — live now in Lucknow &amp; Indore, with Goa,
            Haridwar, Rishikesh and Bangalore launching soon. No driver. No hassle.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CityDropdown value={selectedCity} onChange={setSelectedCity} />
            <button
              onClick={handleFindVehicles}
              disabled={!selectedCity}
              className="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-700 text-primary shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Find Vehicles
            </button>
          </div>

          <div className="mt-9 grid grid-cols-3 gap-3 text-white sm:mt-12 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-4">
            <Stat value={`${getTotalVehicleCount()}+`} label="Vehicles" />
            <Stat value={String(CITIES.length)} label="Cities" />
            <Stat value="4.7★" label="Avg Rating" />
          </div>
        </div>
      </section>

      {/* Pick your city */}
      <section id="cities" className="scroll-mt-16 bg-background py-16">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-800 text-foreground">Pick Your City</h2>
            <p className="mt-2 text-muted-foreground">
              Live now in Lucknow &amp; Indore — more cities launching soon
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6 lg:gap-5">
            {CITIES.map((city) => {
              const live = isCityLive(city);
              return (
                <button
                  key={city}
                  onClick={() => handleCityCardClick(city)}
                  className="card-hover group relative h-40 overflow-hidden rounded-2xl text-left sm:h-48 lg:h-56"
                >
                  <Image
                    src={CITY_META[city].image}
                    alt={city}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="city-card-overlay absolute inset-0" />
                  {live ? (
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-700 text-foreground">
                      {getVehicleCountForCity(city)} vehicles
                    </span>
                  ) : (
                    <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-700 text-white">
                      Coming Soon
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                    <div>
                      <p className="text-base font-800 text-white">{city}</p>
                      <p className="text-xs text-white/80">{CITY_META[city].tagline}</p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:scale-110">
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-800 text-foreground">How Rento Works</h2>
          </div>

          <div className="relative mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="relative text-center sm:text-left">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute left-1/2 top-8 hidden h-px w-full bg-gradient-to-r from-primary/40 to-transparent sm:block" />
                )}
                <div className="relative inline-flex">
                  <span className="pointer-events-none select-none text-5xl font-900 text-foreground/5">
                    0{i + 1}
                  </span>
                  <span className="shadow-primary absolute -bottom-2 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-2xl bg-primary text-white sm:left-0 sm:translate-x-0">
                    <step.icon size={26} />
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-700 text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What do you want to ride */}
      <section className="bg-background py-16">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-800 text-foreground">What do you want to ride?</h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => {
              const style = CATEGORY_STYLE[cat.key];
              return (
                <button
                  key={cat.key}
                  onClick={handleCategoryPick}
                  className={`card-hover flex min-h-48 flex-col items-start rounded-2xl border-2 ${style.border} ${style.bg} p-5 text-left sm:min-h-52 sm:p-6`}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${style.iconBg} text-foreground sm:h-14 sm:w-14`}>
                    <style.icon size={22} className="sm:hidden" />
                    <style.icon size={26} className="hidden sm:block" />
                  </span>
                  <p className="mt-4 text-base font-700 text-foreground sm:text-lg">{cat.label}s</p>
                  <p className="mt-1 text-sm text-muted-foreground">{style.blurb}</p>
                  <p className="mt-4 text-sm font-700 text-foreground">
                    Starting ₹{FALLBACK_STARTING_PRICE[cat.key]}/day
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-foreground py-14">
        <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <item.icon size={20} />
              </span>
              <h3 className="mt-3 text-base font-700 text-white">{item.title}</h3>
              <p className="mt-1 text-sm text-white/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-800 tabular-nums">{value}</p>
      <p className="text-sm text-white/80">{label}</p>
    </div>
  );
}
