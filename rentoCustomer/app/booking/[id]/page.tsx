"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, CreditCard, Store, CheckCircle2, Minus, Plus } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PickupLocationMap from "@/components/PickupLocationMap";
import { useApp } from "../../providers";
import { useToast } from "@/components/Toast";
import type { Booking, RentalMode } from "@/lib/types";

const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const hour24 = i + 6; // 6 AM to 8 PM
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { value: `${String(hour24).padStart(2, "0")}:00`, label: `${hour12}:00 ${period}` };
});

const HOUR_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateBookingId() {
  return `RNT-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
}

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const {
    user,
    addBooking,
    openLoginModal,
    getAvailableStock,
    getVehicleById,
    partnerVehiclesLoading,
    refreshVehicleAvailability,
  } = useApp();
  const { showToast } = useToast();
  const vehicle = getVehicleById(params.id);
  const availableUnits = vehicle ? getAvailableStock(vehicle) : 0;
  const soldOut = availableUnits <= 0;

  const [rentalMode, setRentalMode] = useState<RentalMode>("Daily");
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnDate, setReturnDate] = useState(addDaysISO(todayISO(), 1));
  const [returnTime, setReturnTime] = useState("10:00");
  const [hours, setHours] = useState(4);
  const [quantity, setQuantity] = useState(1);
  const [dateError, setDateError] = useState("");
  const [promptedLogin, setPromptedLogin] = useState(false);

  useEffect(() => {
    if (!user?.isLoggedIn && vehicle && !promptedLogin) {
      showToast("Please log in to book a vehicle");
      openLoginModal();
      setPromptedLogin(true);
    }
  }, [user, vehicle, promptedLogin, showToast, openLoginModal]);

  // If another tab books units of this vehicle while this form is open, make sure
  // the selected quantity never exceeds what's actually still available.
  useEffect(() => {
    setQuantity((q) => Math.min(q, Math.max(1, availableUnits)));
  }, [availableUnits]);

  const pickupDateTime = useMemo(() => new Date(`${pickupDate}T${pickupTime}`), [pickupDate, pickupTime]);
  const returnDateTime = useMemo(() => {
    if (rentalMode === "Hourly") {
      const d = new Date(pickupDateTime);
      d.setHours(d.getHours() + hours);
      return d;
    }
    return new Date(`${returnDate}T${returnTime}`);
  }, [rentalMode, pickupDateTime, hours, returnDate, returnTime]);

  const validRange = returnDateTime.getTime() > pickupDateTime.getTime();
  const days =
    rentalMode === "Daily" && validRange
      ? Math.max(1, Math.ceil((returnDateTime.getTime() - pickupDateTime.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

  if (!vehicle && partnerVehiclesLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="flex flex-1 items-center justify-center px-5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="flex flex-1 items-center justify-center px-5 text-sm text-muted-foreground">
          This vehicle could not be found.
        </main>
        <Footer />
      </div>
    );
  }

  if (!user?.isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">Login to continue booking this vehicle.</p>
          <button onClick={openLoginModal} className="btn-primary px-5 py-2 text-sm">
            Login / Sign Up
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  if (soldOut) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm font-700 text-foreground">
            All {vehicle.stock} unit{vehicle.stock > 1 ? "s" : ""} of the {vehicle.name} are booked
          </p>
          <p className="text-sm text-muted-foreground">
            Someone just booked the last one at {vehicle.shop.name}. Try another vehicle instead.
          </p>
          <button
            onClick={() => router.push(`/vehicles/${vehicle.id}`)}
            className="btn-primary px-5 py-2 text-sm"
          >
            Back to Vehicle
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const baseRentalCost = rentalMode === "Daily" ? days * vehicle.pricePerDay : hours * vehicle.pricePerHour;
  const rentalCost = baseRentalCost * quantity;
  const securityDeposit = vehicle.securityDeposit * quantity;
  const totalOnline = rentalCost;
  const totalAtShop = securityDeposit;
  const durationLabel =
    rentalMode === "Daily" ? `${days || 1} day${(days || 1) > 1 ? "s" : ""}` : `${hours} hour${hours > 1 ? "s" : ""}`;

  async function handleConfirm() {
    if (rentalMode === "Daily" && !validRange) {
      setDateError("Return date/time must be after pickup date/time");
      return;
    }
    // Final recheck at the moment of confirming — a live server query, not the possibly
    // stale merged vehicle list, so it reflects bookings made moments ago from any other
    // browser, device, or customer. The API also enforces this independently on submit,
    // so this is a UX nicety rather than the only thing standing between two customers
    // booking the same last unit.
    const liveAvailable = await refreshVehicleAvailability(vehicle!.id);
    const freshAvailable = liveAvailable ?? getAvailableStock(vehicle!);
    if (freshAvailable < quantity) {
      showToast(
        freshAvailable <= 0
          ? "Sorry, someone just booked the last unit. Please pick another vehicle."
          : `Only ${freshAvailable} unit${freshAvailable > 1 ? "s" : ""} left now — please adjust the quantity.`,
        "error"
      );
      if (freshAvailable <= 0) {
        router.push(`/vehicles/${vehicle!.id}`);
      } else {
        setQuantity(freshAvailable);
      }
      return;
    }
    const booking: Booking = {
      id: generateBookingId(),
      vehicleId: vehicle!.id,
      vehicleName: vehicle!.name,
      vehicleImage: vehicle!.image,
      vehiclePhoto: vehicle!.photo,
      city: vehicle!.city,
      category: vehicle!.category,
      shop: vehicle!.shop,
      rentalMode,
      pickupDateTime: pickupDateTime.toISOString(),
      returnDateTime: returnDateTime.toISOString(),
      days: rentalMode === "Daily" ? days : 0,
      hours: rentalMode === "Hourly" ? hours : 0,
      quantity,
      pricePerDay: vehicle!.pricePerDay,
      pricePerHour: vehicle!.pricePerHour,
      rentalCost,
      securityDeposit,
      totalPayableOnline: totalOnline,
      totalPayableAtShop: totalAtShop,
      status: "Upcoming",
      paymentStatus: "Pending",
      createdAt: new Date().toISOString(),
    };
    try {
      await addBooking(booking);
      router.push(`/confirmation/${booking.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save your booking. Please try again.", "error");
      void refreshVehicleAvailability(vehicle!.id);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 lg:pb-0">
      <Nav />

      <div className="mx-auto w-full max-w-screen-xl px-4 pt-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        / <span>{vehicle.category}s in {vehicle.city}</span> / <span className="text-foreground">{vehicle.name}</span>
      </div>

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-secondary/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-700 uppercase tracking-wide text-primary">Vehicle Selected</p>
                {vehicle.stock > 1 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-700 text-green-700">
                    {availableUnits} of {vehicle.stock} units free
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-3xl">
                  {vehicle.photo ? (
                    <Image src={vehicle.photo} alt={vehicle.name} fill sizes="64px" className="object-cover" />
                  ) : (
                    vehicle.image
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-800 text-foreground">{vehicle.name}</p>
                    <span className="shrink-0 rounded bg-green-600 px-1.5 py-0.5 text-xs font-700 text-white">
                      {vehicle.rating.toFixed(1)} ★
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.brand} · {vehicle.category} · {vehicle.engineLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{vehicle.specs.fuel}</span>
                    <span>{vehicle.specs.mileage}</span>
                    <span>{vehicle.specs.seats} seats</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-white px-3 py-2 text-xs">
                <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-700 text-foreground">{vehicle.shop.name}</p>
                  <p className="text-muted-foreground">{vehicle.shop.address}</p>
                </div>
              </div>
              <div className="mt-2">
                <PickupLocationMap shop={vehicle.shop} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {vehicle.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-600 text-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {availableUnits > 1 && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-700 text-foreground">How many {vehicle.name}s?</p>
                    <p className="text-[11px] text-muted-foreground">
                      Book multiple units together in one trip — up to {availableUnits} available
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-full border border-border px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-30"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center text-sm font-800 text-foreground">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(availableUnits, q + 1))}
                      disabled={quantity >= availableUnits}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-30"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-700 text-foreground">Select Rental Duration</p>

              <div className="mt-3 inline-flex rounded-xl bg-muted p-1">
                {(["Daily", "Hourly"] as RentalMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setRentalMode(mode);
                      setDateError("");
                    }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-700 transition ${
                      rentalMode === mode ? "bg-card text-primary shadow-card" : "text-muted-foreground"
                    }`}
                  >
                    {mode} Rental
                  </button>
                ))}
              </div>

              {rentalMode === "Daily" ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Pickup Date</span>
                    <input
                      type="date"
                      value={pickupDate}
                      min={todayISO()}
                      onChange={(e) => {
                        setPickupDate(e.target.value);
                        setDateError("");
                      }}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Return Date</span>
                    <input
                      type="date"
                      value={returnDate}
                      min={pickupDate}
                      onChange={(e) => {
                        setReturnDate(e.target.value);
                        setDateError("");
                      }}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Pickup Time</span>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {TIME_SLOTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Return Time</span>
                    <select
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {TIME_SLOTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Pickup Date</span>
                    <input
                      type="date"
                      value={pickupDate}
                      min={todayISO()}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-600 text-muted-foreground">Pickup Time</span>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {TIME_SLOTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-xs font-600 text-muted-foreground">Duration</span>
                    <select
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {h} hour{h > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {dateError && <p className="mt-2 text-xs font-600 text-red-500">{dateError}</p>}

              <div className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs font-700 text-primary">
                ☀ Rental duration: {durationLabel}
                {rentalMode === "Hourly" &&
                  ` · Return by ${returnDateTime.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Vehicle must be returned to the same pickup shop by the selected return time. Late
                returns are charged at 1.5× the daily rate per additional hour.
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-700 text-foreground">Price Breakdown</p>
              <p className="text-xs text-muted-foreground">Transparent pricing — no hidden charges</p>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-700 uppercase tracking-wide text-foreground">Rental Cost — Pay Online</p>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-700 text-blue-600">
                  {rentalMode === "Daily" ? "Daily Rate" : "Hourly Rate"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{vehicle.name}</span>
                <span className="font-600 text-foreground">
                  ₹{rentalMode === "Daily" ? vehicle.pricePerDay : vehicle.pricePerHour}
                  {rentalMode === "Daily" ? "/day" : "/hr"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Number of {rentalMode === "Daily" ? "days" : "hours"}
                </span>
                <span className="font-600 text-foreground">× {rentalMode === "Daily" ? days || 1 : hours}</span>
              </div>
              {quantity > 1 && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Number of vehicles</span>
                  <span className="font-600 text-foreground">× {quantity}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-border pt-2 text-sm font-700">
                <span className="text-foreground">Total Rental Cost</span>
                <span className="text-primary">₹{rentalCost || vehicle.pricePerDay}</span>
              </div>

              <div className="my-4 border-t border-border" />

              <p className="text-xs font-700 uppercase tracking-wide text-foreground">
                Security Deposit — Pay at Shop
              </p>
              <div className="mt-2 rounded-xl bg-amber-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-800 text-amber-700">₹{securityDeposit}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-700 text-amber-700">
                    At Pickup Shop
                  </span>
                </div>
                <p className="text-xs font-600 text-amber-700">
                  Refundable deposit{quantity > 1 ? ` (₹${vehicle.securityDeposit} × ${quantity} vehicles)` : ""}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800/80">
                  This amount is collected in cash at <strong>{vehicle.shop.name}</strong> when you
                  pick up the vehicle. It is fully refunded when you return the vehicle in the same
                  condition.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-primary p-3 text-primary-foreground">
                  <CreditCard size={22} />
                  <div>
                    <p className="text-[11px] font-700 uppercase tracking-wide opacity-90">Pay Online Now</p>
                    <p className="text-lg font-800">₹{totalOnline || vehicle.pricePerDay}</p>
                    <p className="text-[11px] opacity-90">Rental cost for {durationLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-amber-100 p-3 text-amber-800">
                  <Store size={22} />
                  <div>
                    <p className="text-[11px] font-700 uppercase tracking-wide opacity-80">Pay at Pickup Shop</p>
                    <p className="text-lg font-800">₹{totalAtShop}</p>
                    <p className="text-[11px] opacity-80">Refundable security deposit</p>
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {[
                  "Fuel not included — vehicle provided with full tank",
                  "Helmet provided free of cost",
                  "Free cancellation up to 24 hrs before pickup",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                    {line}
                  </li>
                ))}
              </ul>

              <button onClick={handleConfirm} className="btn-primary mt-5 hidden w-full py-3.5 text-sm lg:block">
                Confirm Booking{quantity > 1 ? ` (${quantity} vehicles)` : ""} · Pay ₹{totalOnline || vehicle.pricePerDay} Online
              </button>
              <p className="mt-2 hidden text-center text-[11px] text-muted-foreground lg:block">
                By confirming, you agree to Rento&apos;s Rental Terms
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-4 py-3 lg:hidden">
        <button onClick={handleConfirm} className="btn-primary w-full py-3.5 text-sm">
          Confirm Booking{quantity > 1 ? ` (${quantity} vehicles)` : ""} · Pay ₹{totalOnline || vehicle.pricePerDay} Online
        </button>
      </div>

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
}
