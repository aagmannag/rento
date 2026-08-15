"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Car } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CategoryPhotoPlaceholder } from "@/components/CategoryIcon";
import { useVehicles } from "@/lib/hooks";
import type { Category } from "@/lib/types";

const TABS: { key: Category | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Scooty", label: "Scooty" },
  { key: "Bike", label: "Bike" },
  { key: "Car", label: "Car" },
];

export default function VehiclesModerationPage() {
  const { vehicles, loading, setStatus } = useVehicles();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Category | "All">("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (tab === "All" ? vehicles : vehicles.filter((v) => v.category === tab)),
    [vehicles, tab]
  );

  async function handleToggle(id: string, currentStatus: string) {
    setBusyId(id);
    try {
      await setStatus(id, currentStatus === "Active" ? "Inactive" : "Active");
      showToast("Listing updated", "success");
    } catch {
      showToast("Failed to update listing", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Every vehicle listed across all shops, for moderation" />

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
        <EmptyState icon={Car} title="No vehicles" description="No vehicles have been listed in this category yet." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((v) => (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {v.photoUrl ? (
                      <Image src={v.photoUrl} alt={v.name} fill className="object-cover" />
                    ) : (
                      <CategoryPhotoPlaceholder category={v.category} size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-700 text-foreground">{v.brand} {v.name}</p>
                    <Link href={`/shop-owners/${v.ownerId}`} className="truncate text-xs text-muted-foreground hover:text-primary">
                      {v.shopName}
                    </Link>
                  </div>
                  <StatusBadge status={v.status} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{v.category} · {v.city}</span>
                  <span className="font-700 text-foreground">₹{v.pricePerDay}/day · {v.stock} in stock</span>
                </div>
                {v.ownerStatus !== "Approved" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Owner: {v.ownerStatus}</p>
                )}

                <button
                  onClick={() => handleToggle(v.id, v.status)}
                  disabled={busyId === v.id}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border text-xs font-700 text-foreground transition hover:border-primary disabled:opacity-50"
                >
                  {v.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-700 uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Shop</th>
                    <th className="px-5 py-3">City</th>
                    <th className="px-5 py-3">Price/day</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="max-w-[220px] px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                            {v.photoUrl ? (
                              <Image src={v.photoUrl} alt={v.name} fill className="object-cover" />
                            ) : (
                              <CategoryPhotoPlaceholder category={v.category} size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-600 text-foreground">{v.brand} {v.name}</p>
                            <p className="text-xs text-muted-foreground">{v.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[160px] px-5 py-3">
                        <Link href={`/shop-owners/${v.ownerId}`} className="block truncate text-foreground hover:text-primary" title={v.shopName}>
                          {v.shopName}
                        </Link>
                        {v.ownerStatus !== "Approved" && (
                          <p className="truncate text-[11px] text-muted-foreground">Owner: {v.ownerStatus}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{v.city}</td>
                      <td className="px-5 py-3 font-700 text-foreground">₹{v.pricePerDay}</td>
                      <td className="px-5 py-3 text-foreground">{v.stock}</td>
                      <td className="px-5 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggle(v.id, v.status)}
                          disabled={busyId === v.id}
                          className="min-h-[40px] rounded-lg border border-border px-3 py-2 text-xs font-700 text-foreground transition hover:border-primary disabled:opacity-50"
                        >
                          {v.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
