"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  RefreshCw,
  Search,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { CategoryPhotoPlaceholder } from "@/components/CategoryIcon";
import { useFleet } from "@/lib/hooks";
import type { Category, PartnerFleetSummary, VehicleAvailability } from "@/lib/types";

const CATEGORY_TABS: { key: Category | "All"; label: string }[] = [
  { key: "All", label: "All Types" },
  { key: "Scooty", label: "Scooty" },
  { key: "Bike", label: "Bike" },
  { key: "Car", label: "Car" },
];

/** Visual availability bar — green = available, red = booked, grey = zero stock. */
function AvailabilityBar({
  stock,
  booked,
  available,
}: {
  stock: number;
  booked: number;
  available: number;
}) {
  if (stock === 0) {
    return (
      <div className="h-2 w-full rounded-full bg-border" title="No stock" />
    );
  }
  const bookedPct = Math.round((booked / stock) * 100);
  const availPct = 100 - bookedPct;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-border" title={`${available} available · ${booked} booked`}>
      {availPct > 0 && (
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${availPct}%` }}
        />
      )}
      {bookedPct > 0 && (
        <div
          className="h-full bg-rose-500 transition-all"
          style={{ width: `${bookedPct}%` }}
        />
      )}
    </div>
  );
}

/** Badge showing availability status at a glance. */
function AvailBadge({ available, stock }: { available: number; stock: number }) {
  if (stock === 0)
    return (
      <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-700 text-muted-foreground">
        No Stock
      </span>
    );
  if (available === 0)
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-700 text-rose-600">
        Fully Booked
      </span>
    );
  if (available === stock)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-700 text-emerald-700">
        All Free
      </span>
    );
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-700 text-amber-700">
      Partial
    </span>
  );
}

/** Per-vehicle row inside an expanded partner card. */
function VehicleRow({ v }: { v: VehicleAvailability }) {
  return (
    <tr className="border-b border-border last:border-0">
      {/* Photo + name */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {v.photoUrl ? (
              <Image src={v.photoUrl} alt={v.vehicleName} fill className="object-cover" />
            ) : (
              <CategoryPhotoPlaceholder category={v.category} size={16} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-700 text-foreground">{v.vehicleName}</p>
            <p className="text-[10px] text-muted-foreground">
              {v.category} · {v.city}
            </p>
          </div>
        </div>
      </td>
      {/* Price */}
      <td className="px-4 py-2.5 text-xs text-muted-foreground">₹{v.pricePerDay}/day</td>
      {/* Stock */}
      <td className="px-4 py-2.5 text-center">
        <span className="text-xs font-700 text-foreground">{v.stock}</span>
      </td>
      {/* Booked */}
      <td className="px-4 py-2.5 text-center">
        <span
          className={`text-xs font-700 ${v.booked > 0 ? "text-rose-600" : "text-muted-foreground"}`}
        >
          {v.booked}
        </span>
      </td>
      {/* Available */}
      <td className="px-4 py-2.5 text-center">
        <span
          className={`text-xs font-700 ${
            v.available === 0
              ? "text-rose-600"
              : v.available === v.stock
              ? "text-emerald-600"
              : "text-amber-600"
          }`}
        >
          {v.available}
        </span>
      </td>
      {/* Status */}
      <td className="px-4 py-2.5">
        <StatusBadge status={v.status} />
      </td>
      {/* Availability mini-bar */}
      <td className="w-24 px-4 py-2.5">
        <AvailabilityBar stock={v.stock} booked={v.booked} available={v.available} />
      </td>
    </tr>
  );
}

/** A collapsible card for one partner shop. */
function PartnerCard({ partner }: { partner: PartnerFleetSummary }) {
  const [expanded, setExpanded] = useState(false);
  const isInactive = partner.ownerStatus !== "Approved";

  return (
    <div
      className={`rounded-2xl border bg-card shadow-card transition ${
        isInactive ? "border-amber-200 opacity-75" : "border-border"
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-800 text-foreground">{partner.shopName}</p>
            <StatusBadge status={partner.ownerStatus} />
            {isInactive && (
              <span className="flex items-center gap-1 text-[10px] font-600 text-amber-600">
                <AlertTriangle size={10} /> Inactive — vehicles hidden from customers
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {partner.ownerName} · {partner.city}
          </p>

          {/* Mini stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-800 text-foreground">{partner.totalStock}</p>
              <p className="text-[10px] text-muted-foreground">Total Stock</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-800 ${partner.totalBooked > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                {partner.totalBooked}
              </p>
              <p className="text-[10px] text-muted-foreground">Booked</p>
            </div>
            <div className="text-center">
              <p
                className={`text-lg font-800 ${
                  partner.totalAvailable === 0
                    ? "text-rose-600"
                    : partner.totalAvailable === partner.totalStock
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {partner.totalAvailable}
              </p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
            <div className="flex-1 min-w-[80px]">
              <AvailabilityBar
                stock={partner.totalStock}
                booked={partner.totalBooked}
                available={partner.totalAvailable}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {partner.totalStock > 0
                  ? `${Math.round((partner.totalAvailable / partner.totalStock) * 100)}% free`
                  : "No stock"}
              </p>
            </div>
            <AvailBadge available={partner.totalAvailable} stock={partner.totalStock} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <Link
            href={`/shop-owners/${partner.ownerId}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden rounded-lg border border-border px-3 py-1.5 text-[11px] font-700 text-foreground transition hover:border-primary sm:block"
          >
            View Shop
          </Link>
          {expanded ? (
            <ChevronUp size={18} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={18} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded vehicle table */}
      {expanded && (
        <div className="border-t border-border">
          {partner.vehicles.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No vehicles listed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-700 uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Vehicle</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5 text-center">Stock</th>
                    <th className="px-4 py-2.5 text-center">Booked</th>
                    <th className="px-4 py-2.5 text-center">Available</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="w-24 px-4 py-2.5">Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {partner.vehicles.map((v) => (
                    <VehicleRow key={v.vehicleId} v={v} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border px-5 py-3">
            <Link
              href={`/shop-owners/${partner.ownerId}`}
              className="text-xs font-600 text-primary hover:underline"
            >
              View full shop profile →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  const { fleet, loading, refresh } = useFleet();
  const [categoryTab, setCategoryTab] = useState<Category | "All">("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Derive the list of cities from the data (avoids hardcoding)
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of fleet) set.add(p.city);
    return ["All", ...Array.from(set).sort()];
  }, [fleet]);

  // Platform-wide totals (across all partners, before filters)
  const totals = useMemo(
    () =>
      fleet.reduce(
        (acc, p) => ({
          stock: acc.stock + p.totalStock,
          booked: acc.booked + p.totalBooked,
          available: acc.available + p.totalAvailable,
        }),
        { stock: 0, booked: 0, available: 0 }
      ),
    [fleet]
  );

  // Apply filters to the per-partner fleet list.
  // Category filter is applied at the vehicle level and the partner is included
  // only if at least one of its vehicles matches — so the partner card shows only
  // the relevant vehicles when expanded.
  const filteredFleet = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fleet
      .map((p) => {
        // Filter vehicles by category
        const filteredVehicles =
          categoryTab === "All"
            ? p.vehicles
            : p.vehicles.filter((v) => v.category === categoryTab);

        // Recompute partner-level totals for the filtered vehicle set
        const totalStock = filteredVehicles.reduce((s, v) => s + v.stock, 0);
        const totalBooked = filteredVehicles.reduce((s, v) => s + v.booked, 0);
        const totalAvailable = filteredVehicles.reduce((s, v) => s + v.available, 0);

        return { ...p, vehicles: filteredVehicles, totalStock, totalBooked, totalAvailable };
      })
      .filter((p) => {
        if (p.vehicles.length === 0) return false;
        if (cityFilter !== "All" && p.city !== cityFilter) return false;
        if (q && !p.shopName.toLowerCase().includes(q) && !p.ownerName.toLowerCase().includes(q))
          return false;
        return true;
      });
  }, [fleet, categoryTab, cityFilter, search]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div>
      <PageHeader
        title="Fleet & Availability"
        subtitle="Real-time stock and booking counts across every partner shop"
      />

      {/* Platform totals */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Fleet Stock"
          value={loading ? "…" : String(totals.stock)}
          icon={Car}
          tone="primary"
        />
        <StatCard
          label="Currently Booked"
          value={loading ? "…" : String(totals.booked)}
          icon={Car}
          tone={totals.booked > 0 ? "warning" : "default"}
          hint={totals.booked > 0 ? "Active reservations" : "No active bookings"}
        />
        <StatCard
          label="Available Now"
          value={loading ? "…" : String(totals.available)}
          icon={CheckCircle2}
          tone={totals.available === 0 && totals.stock > 0 ? "danger" : "default"}
          hint={
            totals.stock > 0
              ? `${Math.round((totals.available / totals.stock) * 100)}% of total fleet`
              : undefined
          }
        />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setCategoryTab(t.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-600 transition ${
                categoryTab === t.key
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* City filter */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-600 text-foreground outline-none focus:border-primary"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All Cities" : c}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shop or owner…"
            className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>

        {/* Manual refresh */}
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-600 text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
          title="Refresh now"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="mb-3 text-xs text-muted-foreground">
          {filteredFleet.length === 0
            ? "No partners match your filters."
            : `${filteredFleet.length} partner${filteredFleet.length > 1 ? "s" : ""} · auto-refreshes every 8s`}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : filteredFleet.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No partners found"
          description={
            search || cityFilter !== "All" || categoryTab !== "All"
              ? "Try adjusting your filters."
              : "No shop owners have listed any vehicles yet."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredFleet.map((partner) => (
            <PartnerCard key={partner.ownerId} partner={partner} />
          ))}
        </div>
      )}
    </div>
  );
}
