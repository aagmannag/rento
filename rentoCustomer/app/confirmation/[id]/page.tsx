"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PaymentPanel from "@/components/PaymentPanel";
import PickupLocationMap from "@/components/PickupLocationMap";
import { useApp } from "../../providers";
import type { Booking } from "@/lib/types";

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getBooking, updateBookingLocal } = useApp();
  const booking = getBooking(params.id);

  if (!booking) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <Header title="Booking" backHref="/" />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find this booking in the current session.
          </p>
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
      <Header title="Booking Confirmed" showBack={false} />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {booking.paymentStatus === "Verified" ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="mt-3 text-xl font-800 text-foreground">Booking Confirmed!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your {booking.category.toLowerCase()} is reserved.
              </p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
                <Clock size={32} />
              </div>
              <h2 className="mt-3 text-xl font-800 text-foreground">Almost there — complete payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your {booking.category.toLowerCase()} is on hold. Pay via UPI below to confirm it.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-primary/40 bg-secondary p-4 text-center">
          <p className="text-xs font-600 text-muted-foreground">Booking ID</p>
          <p className="text-lg font-800 tracking-wide text-primary">{booking.id}</p>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-3xl">
            {booking.vehiclePhoto ? (
              <Image src={booking.vehiclePhoto} alt={booking.vehicleName} fill sizes="56px" className="object-cover" />
            ) : (
              booking.vehicleImage
            )}
          </div>
          <div>
            <p className="text-sm font-700 text-foreground">
              {booking.quantity > 1 ? `${booking.quantity} × ` : ""}
              {booking.vehicleName}
            </p>
            <p className="text-xs text-muted-foreground">
              {booking.category} · {booking.city}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-700 text-foreground">Pickup details</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-foreground">{booking.shop.name}</p>
            <p className="text-xs text-muted-foreground">{booking.shop.address}</p>
          </div>
          <div className="mt-3">
            <PickupLocationMap shop={booking.shop} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Pickup</p>
              <p className="font-700 text-foreground">{formatDateTime(booking.pickupDateTime)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Return</p>
              <p className="font-700 text-foreground">{formatDateTime(booking.returnDateTime)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-700 text-foreground">Payment summary</p>

          <div
            className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
              booking.paymentStatus === "Verified" ? "bg-green-50" : "bg-secondary"
            }`}
          >
            <span className="font-600 text-foreground">
              {booking.paymentStatus === "Verified" ? "Paid via UPI" : "Amount due via UPI"}
            </span>
            <span className={`font-800 ${booking.paymentStatus === "Verified" ? "text-green-700" : "text-primary"}`}>
              ₹{booking.totalPayableOnline}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {booking.rentalMode === "Daily"
              ? `Rental cost for ${booking.days} day${booking.days > 1 ? "s" : ""} (₹${booking.pricePerDay} × ${booking.days}${
                  booking.quantity > 1 ? ` × ${booking.quantity} vehicles` : ""
                })`
              : `Rental cost for ${booking.hours} hour${booking.hours > 1 ? "s" : ""} (₹${booking.pricePerHour} × ${booking.hours}${
                  booking.quantity > 1 ? ` × ${booking.quantity} vehicles` : ""
                })`}
          </p>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm">
            <span className="font-600 text-foreground">Payable at shop</span>
            <span className="font-800 text-amber-700">₹{booking.totalPayableAtShop}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Refundable security deposit{booking.quantity > 1 ? ` for ${booking.quantity} vehicles` : ""} — pay in
            cash/UPI at pickup, refunded on return
          </p>

          <PaymentPanel booking={booking} onUpdated={(updated: Booking) => updateBookingLocal(updated)} />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/my-bookings" className="btn-primary flex-1 py-3 text-center text-sm">
            View My Bookings
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-xl border border-border py-3 text-center text-sm font-700 text-foreground transition active:scale-[0.98]"
          >
            Back to Home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
