"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  Pending: "Payment due",
  Submitted: "Payment pending verification",
  Verified: "Payment verified",
  Rejected: "Payment rejected",
};

export default function MyBookingsPage() {
  const { user, bookings, openLoginModal } = useApp();

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
        {bookings.length === 0 ? (
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
              <Link
                key={b.id}
                href={`/confirmation/${b.id}`}
                className="card-hover block rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-2xl">
                      {b.vehiclePhoto ? (
                        <Image src={b.vehiclePhoto} alt={b.vehicleName} fill sizes="48px" className="object-cover" />
                      ) : (
                        b.vehicleImage
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
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
