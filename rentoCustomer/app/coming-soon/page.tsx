"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Rocket, Bell, MapPin } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import { CITY_META, LIVE_CITIES } from "@/lib/data";
import { useApp } from "../providers";
import type { City } from "@/lib/types";

function ComingSoonInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedCity, setSelectedCity } = useApp();
  const { showToast } = useToast();
  const [notifyValue, setNotifyValue] = useState("");
  const [notified, setNotified] = useState(false);

  const city = (searchParams.get("city") as City | null) ?? selectedCity;

  if (!city) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">No city selected.</p>
          <Link href="/" className="btn-primary px-5 py-2 text-sm">
            Back to Home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyValue.trim()) {
      showToast("Enter your phone or email to get notified");
      return;
    }
    setNotified(true);
    showToast(`You're on the list! We'll notify you when Rento launches in ${city}.`, "success");
  }

  function handleExplore(exploreCity: City) {
    setSelectedCity(exploreCity);
    router.push("/category");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />

      <main className="flex-1">
        <section className="hero-gradient relative overflow-hidden py-16 sm:py-20">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

          <div className="relative mx-auto max-w-screen-md px-4 text-center sm:px-6">
            <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-2xl sm:h-48">
              <Image src={CITY_META[city].image} alt={city} fill sizes="320px" className="object-cover" />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white">
                <MapPin size={22} />
                <span className="text-lg font-800">{city}</span>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-700 text-white backdrop-blur">
              <Rocket size={14} /> Launching Soon
            </div>

            <h1 className="text-hero-xl mt-4 text-white">Rento is coming to {city}</h1>
            <p className="text-hero-sub mx-auto mt-3 max-w-md text-white/90">
              We&apos;re onboarding verified vehicles and setting up pickup shops in {city}.
              Be the first to know the moment we go live.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-screen-md px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="flex items-center gap-2 text-sm font-700 text-foreground">
              <Bell size={16} className="text-primary" /> Get notified at launch
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drop your phone number or email — no spam, just one message when {city} goes live.
            </p>

            {notified ? (
              <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-600 text-green-700">
                You&apos;re on the list for {city}. We&apos;ll be in touch soon!
              </div>
            ) : (
              <form onSubmit={handleNotify} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={notifyValue}
                  onChange={(e) => setNotifyValue(e.target.value)}
                  placeholder="Phone number or email"
                  className="flex-1 rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
                  Notify Me
                </button>
              </form>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm font-700 text-foreground">Already live and ready to ride</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Explore Rento in these cities right now
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {LIVE_CITIES.map((liveCity) => (
                <button
                  key={liveCity}
                  onClick={() => handleExplore(liveCity)}
                  className="card-hover flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-700 text-foreground shadow-card"
                >
                  <MapPin size={15} className="text-primary" /> {liveCity}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={null}>
      <ComingSoonInner />
    </Suspense>
  );
}
