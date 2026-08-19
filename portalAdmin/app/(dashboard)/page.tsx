"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Banknote,
  Car,
  CheckCircle2,
  Clock,
  IndianRupee,
  Store,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useAdmin } from "@/app/providers";
import { useStats, useShopOwners, usePayments, useFleet } from "@/lib/hooks";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const { admin } = useAdmin();
  const { stats, loading: statsLoading } = useStats();
  const { owners: pendingOwners, loading: pendingLoading } = useShopOwners("Pending");
  const { payments, loading: paymentsLoading } = usePayments();
  const { fleet, loading: fleetLoading } = useFleet();

  const loading = statsLoading;
  const recentPending = pendingOwners.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  // Platform-wide available stock (excludes Suspended/Rejected owner vehicles since
  // those are hidden from customers anyway, but still counts them so the admin can
  // see the full picture of reserved units across all partners).
  const totalAvailable = fleet.reduce((s, p) => s + p.totalAvailable, 0);
  const totalFleetStock = fleet.reduce((s, p) => s + p.totalStock, 0);

  const needsAttention = (stats?.pendingOwners ?? 0) + payments.length;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${admin?.name?.split(" ")[0] ?? ""}`}
        subtitle={
          !loading && !paymentsLoading && needsAttention > 0
            ? `${needsAttention} item${needsAttention > 1 ? "s" : ""} need your attention`
            : "Platform overview — everything's caught up"
        }
      />

      <p className="mb-3 text-xs font-700 uppercase tracking-wide text-muted-foreground">Shop owners</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Shop Owners"
          value={loading ? "…" : String(stats?.totalOwners ?? 0)}
          icon={Store}
          tone="primary"
          href="/shop-owners"
        />
        <StatCard
          label="Pending Approval"
          value={loading ? "…" : String(stats?.pendingOwners ?? 0)}
          icon={Clock}
          tone={stats && stats.pendingOwners > 0 ? "warning" : "default"}
          hint={stats && stats.pendingOwners > 0 ? "Needs your review" : undefined}
          href="/shop-owners?status=Pending"
        />
        <StatCard
          label="Approved"
          value={loading ? "…" : String(stats?.approvedOwners ?? 0)}
          icon={CheckCircle2}
          href="/shop-owners?status=Approved"
        />
        <StatCard
          label="Rejected / Suspended"
          value={loading ? "…" : String((stats?.rejectedOwners ?? 0) + (stats?.suspendedOwners ?? 0))}
          icon={XCircle}
          tone={stats && stats.rejectedOwners + stats.suspendedOwners > 0 ? "danger" : "default"}
          href="/shop-owners?status=Rejected"
        />
      </div>

      <p className="mb-3 mt-8 text-xs font-700 uppercase tracking-wide text-muted-foreground">Marketplace</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Vehicles" value={loading ? "…" : String(stats?.totalVehicles ?? 0)} icon={Car} href="/vehicles" />
        <StatCard label="Active Listings" value={loading ? "…" : String(stats?.activeVehicles ?? 0)} icon={Car} href="/vehicles" />
        <StatCard label="Total Bookings" value={loading ? "…" : String(stats?.totalBookings ?? 0)} icon={Banknote} />
        <StatCard
          label="Available Now"
          value={fleetLoading ? "…" : String(totalAvailable)}
          icon={CheckCircle2}
          tone={!fleetLoading && totalAvailable === 0 && totalFleetStock > 0 ? "danger" : "default"}
          hint={
            !fleetLoading && totalFleetStock > 0
              ? `${Math.round((totalAvailable / totalFleetStock) * 100)}% of fleet free`
              : undefined
          }
          href="/fleet"
        />
        <StatCard
          label="Payments Awaiting Verification"
          value={paymentsLoading ? "…" : String(payments.length)}
          icon={IndianRupee}
          tone={payments.length > 0 ? "warning" : "default"}
          hint={payments.length > 0 ? "Needs your review" : undefined}
          href="/payments"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-800 text-foreground">Pending Applications</h2>
              <p className="text-xs text-muted-foreground">New shop owners waiting for review</p>
            </div>
            <Link href="/shop-owners?status=Pending" className="flex items-center gap-1 text-sm font-600 text-primary">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {!pendingLoading && recentPending.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                description="No shop owner applications waiting for review right now."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentPending.map((o) => (
                <Link
                  key={o.id}
                  href={`/shop-owners/${o.id}`}
                  className="flex items-center justify-between px-5 py-3.5 text-sm transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-600 text-foreground">{o.shopName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.ownerName} · {o.city} · Applied {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-700 text-primary">Review →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-800 text-foreground">Payments Awaiting Verification</h2>
              <p className="text-xs text-muted-foreground">Cross-check the UTR before confirming</p>
            </div>
            <Link href="/payments" className="flex items-center gap-1 text-sm font-600 text-primary">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {!paymentsLoading && recentPayments.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Banknote}
                title="Nothing waiting"
                description="Payment submissions from customers will show up here."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map((p) => (
                <Link
                  key={p.id}
                  href="/payments"
                  className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {p.vehiclePhoto && <Image src={p.vehiclePhoto} alt={p.vehicleName} fill className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-600 text-foreground">{p.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.vehicleName} · {formatDateTime(p.paymentSubmittedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-700 text-foreground">₹{p.totalPayableOnline}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
