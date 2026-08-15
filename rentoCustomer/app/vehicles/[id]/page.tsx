"use client";

import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Stars from "@/components/Stars";
import PickupLocationMap from "@/components/PickupLocationMap";
import VehicleGallery from "@/components/VehicleGallery";
import { useApp } from "../../providers";

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getAvailableStock, getVehicleById, partnerVehiclesLoading } = useApp();
  const vehicle = getVehicleById(params.id);
  const availableUnits = vehicle ? getAvailableStock(vehicle) : 0;
  const soldOut = availableUnits <= 0;

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
        <Header title="Not found" />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">This vehicle could not be found.</p>
          <button onClick={() => router.push("/")} className="btn-primary px-5 py-2 text-sm">
            Back to Home
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title={vehicle.name} />

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 pb-24 sm:px-6 lg:pb-8 lg:px-8">
        <div className="mt-6 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <VehicleGallery photos={vehicle.photos} name={vehicle.name} category={vehicle.category} />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-800 text-foreground">{vehicle.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {vehicle.city} · {vehicle.category}
                </p>
              </div>
              <Stars rating={vehicle.rating} count={vehicle.ratingCount} />
            </div>

            {soldOut ? (
              <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs font-600 text-muted-foreground">
                All {vehicle.stock} unit{vehicle.stock > 1 ? "s" : ""} of this model are currently
                booked at {vehicle.shop.name}. You may still browse details.
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-700 text-green-700">
                {availableUnits} of {vehicle.stock} unit{vehicle.stock > 1 ? "s" : ""} available right
                now at {vehicle.shop.name}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Spec label="Fuel" value={vehicle.specs.fuel} />
              <Spec label="Transmission" value={vehicle.specs.transmission} />
              <Spec label="Seats" value={String(vehicle.specs.seats)} />
              <Spec label="Mileage" value={vehicle.specs.mileage} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {vehicle.features.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-600 text-primary"
                >
                  {f}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-700 text-foreground">Pickup shop</p>
              <p className="mt-1 text-sm text-foreground">{vehicle.shop.name}</p>
              <p className="text-xs text-muted-foreground">{vehicle.shop.address}</p>
              <div className="mt-3">
                <PickupLocationMap shop={vehicle.shop} />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-700 text-foreground">Price breakdown</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rental price</span>
                <span className="font-700 text-foreground">
                  ₹{vehicle.pricePerDay} / day <span className="text-primary">(₹{vehicle.pricePerHour}/hr)</span>
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Security deposit</span>
                <span className="font-700 text-foreground">₹{vehicle.securityDeposit}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Security deposit is fully refundable and payable in person at the pickup shop —
                it is not charged online.
              </p>
            </div>

            <div className="mt-6 hidden items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-card lg:flex">
              <div>
                <p className="text-lg font-800 text-foreground">
                  ₹{vehicle.pricePerDay}
                  <span className="text-xs font-600 text-muted-foreground">/day</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  + ₹{vehicle.securityDeposit} refundable deposit
                </p>
              </div>
              <button
                disabled={soldOut}
                onClick={() => router.push(`/booking/${vehicle.id}`)}
                className="btn-primary px-6 py-3 text-sm"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-card px-4 py-3 sm:px-6 lg:hidden">
        <div>
          <p className="text-lg font-800 text-foreground">
            ₹{vehicle.pricePerDay}
            <span className="text-xs font-600 text-muted-foreground">/day</span>
          </p>
          <p className="text-[11px] text-muted-foreground">+ ₹{vehicle.securityDeposit} refundable deposit</p>
        </div>
        <button
          disabled={soldOut}
          onClick={() => router.push(`/booking/${vehicle.id}`)}
          className="btn-primary px-6 py-3 text-sm"
        >
          Book Now
        </button>
      </div>

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-700 text-foreground">{value}</p>
    </div>
  );
}
