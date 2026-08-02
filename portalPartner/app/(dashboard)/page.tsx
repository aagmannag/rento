"use client";

import Link from "next/link";
import Image from "next/image";
import { Car, CalendarCheck, IndianRupee, Layers, Plus, ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useOwner } from "@/app/providers";
import { useVehicles, useBookings } from "@/lib/hooks";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { owner } = useOwner();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { bookings, loading: bookingsLoading } = useBookings();

  const activeListings = vehicles.filter((v) => v.status === "Active").length;
  const upcomingBookings = bookings.filter((b) => b.status === "Upcoming").length;
  // Reflects money actually received (payment verified via UPI), not just trips marked
  // Completed — a booking can be paid well before the rental period is over.
  const earnings = bookings
    .filter((b) => b.paymentStatus === "Verified")
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const loading = vehiclesLoading || bookingsLoading;
  const recentBookings = bookings.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${owner?.ownerName?.split(" ")[0] ?? ""}`}
        subtitle={owner?.shopName}
        action={
          <Link href="/vehicles/new" className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={16} /> Add Vehicle
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Vehicles" value={loading ? "…" : String(vehicles.length)} icon={Car} tone="primary" />
        <StatCard label="Active Listings" value={loading ? "…" : String(activeListings)} icon={Layers} />
        <StatCard label="Upcoming Bookings" value={loading ? "…" : String(upcomingBookings)} icon={CalendarCheck} />
        <StatCard
          label="Total Earnings"
          value={loading ? "…" : `₹${earnings.toLocaleString("en-IN")}`}
          icon={IndianRupee}
          hint="From verified payments"
        />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-800 text-foreground">Recent Bookings</h2>
          <Link href="/bookings" className="flex items-center gap-1 text-sm font-600 text-primary">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {!loading && recentBookings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarCheck}
              title="No bookings yet"
              description="Once customers start booking your vehicles, they'll show up here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-700 uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Pickup</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                          {b.vehiclePhotoUrl && (
                            <Image src={b.vehiclePhotoUrl} alt={b.vehicleName} fill className="object-cover" />
                          )}
                        </div>
                        <span className="font-600 text-foreground">{b.vehicleName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground">{b.customerName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(b.pickupDateTime)}</td>
                    <td className="px-5 py-3 font-700 text-foreground">₹{b.totalAmount}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3"><StatusBadge status={b.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && vehicles.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={Car}
            title="List your first vehicle"
            description="Add a bike, scooty or car with pricing, photos and pickup details to start getting bookings."
            action={
              <Link href="/vehicles/new" className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
                <Plus size={16} /> Add Vehicle
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
