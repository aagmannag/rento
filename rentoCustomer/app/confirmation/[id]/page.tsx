"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Phone, TimerOff } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PaymentPanel from "@/components/PaymentPanel";
import PickupLocationMap from "@/components/PickupLocationMap";
import HoldCountdown from "@/components/HoldCountdown";
import RatingForm from "@/components/RatingForm";
import { CategoryPhotoPlaceholder } from "@/components/CategoryIcon";
import CancellationNotice from "@/components/CancellationNotice";
import { useApp } from "../../providers";
import { formatShopPhone } from "@/lib/phone";
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
  const { getBooking, updateBookingLocal, refreshBooking } = useApp();
  const booking = getBooking(params.id);
  // Always re-check with the server on load — not just when missing locally — so this
  // page shows authoritative status (deep link, a different device, or a client cache
  // that's simply gone stale over a long-open tab) instead of whatever the bulk
  // /api/bookings fetch happened to load at login. getBookingForUser() on the server
  // also lazily flips a stale Pending booking to Expired the moment its 5-minute
  // payment hold elapses, which is what drives the "expired" UI below.
  const [checkedServer, setCheckedServer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCheckedServer(false);
    void refreshBooking(params.id).finally(() => {
      if (!cancelled) setCheckedServer(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!booking) {
    if (!checkedServer) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <Nav />
          <Header title="Booking" backHref="/" />
          <main className="flex flex-1 items-center justify-center px-5">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </main>
          <Footer />
        </div>
      );
    }
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

  const isExpired = booking.paymentStatus === "Expired";

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
          ) : isExpired ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <TimerOff size={32} />
              </div>
              <h2 className="mt-3 text-xl font-800 text-foreground">Payment window expired</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your hold on this {booking.category.toLowerCase()} ran out before payment was completed, so
                it&apos;s been released back for other customers to book.
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
          {booking.paymentStatus === "Pending" && (
            <div className="w-full">
              <HoldCountdown createdAt={booking.createdAt} onExpire={() => void refreshBooking(booking.id)} />
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-primary/40 bg-secondary p-4 text-center">
          <p className="text-xs font-600 text-muted-foreground">Booking ID</p>
          <p className="text-lg font-800 tracking-wide text-primary">{booking.id}</p>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
            {booking.vehiclePhoto ? (
              <Image src={booking.vehiclePhoto} alt={booking.vehicleName} fill sizes="56px" className="object-cover" />
            ) : (
              <CategoryPhotoPlaceholder category={booking.category} size={28} />
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
            {booking.paymentStatus !== "Verified" ? (
              // Withheld until the admin verifies payment — an unpaid/unverified hold
              // has no confirmed booking behind it yet, so there's no reason to hand out
              // the shop's direct number before that (also cuts down on shop owners
              // fielding calls for bookings that never actually get paid for).
              <p className="mt-1.5 text-xs text-muted-foreground">
                Shop contact number will be shown once your payment is verified.
              </p>
            ) : booking.shop.phone ? (
              <a
                href={formatShopPhone(booking.shop.phone).href}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-700 text-primary"
              >
                <Phone size={13} /> {formatShopPhone(booking.shop.phone).display}
              </a>
            ) : (
              // Only bookings made before shop-phone tracking shipped (or, in principle,
              // a shop whose owner record predates a required phone) land here — every
              // booking made going forward always has one.
              <p className="mt-1.5 text-xs text-muted-foreground">
                Shop contact number not available for this booking.
              </p>
            )}
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

          {isExpired ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-700 text-red-700">This booking can no longer be paid for.</p>
              <p className="mt-1 text-xs text-red-600">
                The hold expired and the unit may already be booked by someone else — please start a new
                booking if it&apos;s still available.
              </p>
              <Link href={`/vehicles/${booking.vehicleId}`} className="btn-primary mt-3 inline-block px-5 py-2 text-sm">
                Find this vehicle again
              </Link>
            </div>
          ) : (
            <PaymentPanel booking={booking} onUpdated={(updated: Booking) => updateBookingLocal(updated)} />
          )}
        </div>

        {/* An expired hold already gets its own explanation above, and there was never a
         *  payment to refund, so the policy would only add noise there. */}
        {!isExpired && <CancellationNotice booking={booking} />}

        {booking.status === "Completed" && booking.paymentStatus === "Verified" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-700 text-foreground">Rate your experience</p>
            <RatingForm
              bookingId={booking.id}
              target="partner"
              title={`Rate ${booking.shop.name}`}
              description="How was your experience with this shop and vehicle?"
              existingRating={booking.partnerRating}
              onSubmitted={updateBookingLocal}
            />
            <RatingForm
              bookingId={booking.id}
              target="platform"
              title="Rate the Rento app"
              description="How was your overall booking experience with Rento?"
              existingRating={booking.platformRating}
              onSubmitted={updateBookingLocal}
            />
          </div>
        )}

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
