"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CalendarX2 } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CategoryPhotoPlaceholder } from "@/components/CategoryIcon";
import CancelBookingButton, { isCancellable } from "@/components/CancelBookingButton";
import { useApp } from "../providers";

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, string> = {
  Upcoming: "bg-secondary text-primary",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-muted text-muted-foreground",
};

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-50 text-blue-700",
  Verified: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-600",
  Expired: "bg-red-50 text-red-600",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  Pending: "Payment due",
  Submitted: "Payment pending verification",
  Verified: "Payment verified",
  Rejected: "Payment rejected",
  Expired: "Payment window expired",
};

export default function MyBookingsPage() {
  const { user, bookings, bookingsLoading, bookingsError, refetchBookings, openLoginModal, updateBookingLocal } =
    useApp();

  if (!user?.isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <Header title="My Bookings" showBack={false} />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">Login to see your bookings.</p>
          <button onClick={openLoginModal} className="btn-primary px-5 py-2 text-sm">
            Login
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="My Bookings" showBack={false} />

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {bookingsLoading && bookings.length === 0 ? (
          // Loading and "genuinely empty" must never render the same way — otherwise a
          // slow network or a transient fetch hiccup looks indistinguishable from "you
          // have no bookings", which is exactly the confusing state this replaces.
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading your bookings…</p>
          </div>
        ) : bookingsError && bookings.length === 0 ? (
          // A real fetch failure (network issue, session hiccup, server error) — shown
          // distinctly from "no bookings yet" with a way to retry, instead of silently
          // swallowing the error and rendering a false empty state.
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle size={28} />
            </span>
            <p className="text-sm text-muted-foreground">{bookingsError}</p>
            <button onClick={refetchBookings} className="btn-primary px-5 py-2 text-sm">
              Retry
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarX2 size={28} />
            </span>
            <p className="text-sm text-muted-foreground">You have no bookings yet.</p>
            <Link href="/" className="btn-primary px-5 py-2 text-sm">
              Rent a vehicle
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bookings.map((b) => (
              // The card is a plain container rather than one big link: the cancel
              // control lives inside it, and nesting a button in an anchor is both
              // invalid markup and a keyboard trap. The link covers the card's
              // content instead, and the action row sits outside it.
              <div
                key={b.id}
                className="card-hover flex flex-col rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <Link href={`/confirmation/${b.id}`} className="block flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                        {b.vehiclePhoto ? (
                          <Image src={b.vehiclePhoto} alt={b.vehicleName} fill sizes="48px" className="object-cover" />
                        ) : (
                          <CategoryPhotoPlaceholder category={b.category} size={24} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-700 text-foreground">
                          {b.quantity > 1 ? `${b.quantity} × ` : ""}
                          {b.vehicleName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.city} · {formatDateTime(b.pickupDateTime)}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-700 ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-700 ${PAYMENT_STATUS_STYLE[b.paymentStatus]}`}
                    >
                      {PAYMENT_STATUS_LABEL[b.paymentStatus]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">
                      Booking ID: <span className="font-700 text-foreground">{b.id}</span>
                    </span>
                    <span className="font-800 text-foreground">₹{b.totalPayableOnline}</span>
                  </div>
                </Link>

                {/* Refund outcome of a cancellation, once there is one to report. Null
                    refundAmount means the booking was never cancelled through the app
                    (or predates this being recorded), so nothing is claimed. */}
                {b.status === "Cancelled" && b.refundAmount != null && (
                  <p className="mt-2.5 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    {b.refundAmount > 0 ? (
                      <>
                        Refund of <span className="font-800 text-foreground">₹{b.refundAmount}</span>{" "}
                        ({b.refundPercent}%) is being processed to the account you paid from.
                      </>
                    ) : (
                      "Cancelled — no refund was due under the cancellation policy."
                    )}
                  </p>
                )}

                {isCancellable(b) && (
                  <div className="mt-2.5 flex justify-end">
                    <CancelBookingButton booking={b} onCancelled={updateBookingLocal} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
