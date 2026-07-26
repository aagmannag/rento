"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CalendarCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useBookings } from "@/lib/hooks";
import type { BookingStatus } from "@/lib/types";

const TABS: { key: BookingStatus | "All"; label: string }[] = [
  { key: "Upcoming", label: "Upcoming" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
  { key: "All", label: "All" },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingsPage() {
  const { bookings, loading, setStatus } = useBookings();
  const { showToast } = useToast();
  const [tab, setTab] = useState<BookingStatus | "All">("Upcoming");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (tab === "All" ? bookings : bookings.filter((b) => b.status === tab)),
    [bookings, tab]
  );

  async function handleStatusChange(id: string, status: BookingStatus) {
    setBusyId(id);
    try {
      await setStatus(id, status);
      showToast(`Booking marked ${status.toLowerCase()}`, "success");
    } catch {
      showToast("Failed to update booking", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Track and manage bookings for your vehicles" />

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-600 transition ${
              tab === t.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings here"
          description="Bookings from customers for your listed vehicles will appear in this tab."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-700 uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Pickup</th>
                  <th className="px-5 py-3">Return</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
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
                    <td className="px-5 py-3">
                      <p className="font-600 text-foreground">{b.customerName}</p>
                      <p className="text-xs text-muted-foreground">{b.customerPhone}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(b.pickupDateTime)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(b.returnDateTime)}</td>
                    <td className="px-5 py-3 text-foreground">{b.quantity}</td>
                    <td className="px-5 py-3 font-700 text-foreground">₹{b.totalAmount}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3">
                      <StatusBadge status={b.paymentStatus} />
                      {b.utrNumber && (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">UTR: {b.utrNumber}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {b.status === "Upcoming" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleStatusChange(b.id, "Completed")}
                            disabled={busyId === b.id}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-700 text-foreground hover:border-primary disabled:opacity-50"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleStatusChange(b.id, "Cancelled")}
                            disabled={busyId === b.id}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-700 text-foreground hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
