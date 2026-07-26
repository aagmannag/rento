"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Car, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import OwnerVehicleCard from "@/components/OwnerVehicleCard";
import { useToast } from "@/components/Toast";
import { useVehicles } from "@/lib/hooks";
import type { Category } from "@/lib/types";

const TABS: { key: Category | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Scooty", label: "Scooty" },
  { key: "Bike", label: "Bike" },
  { key: "Car", label: "Car" },
];

export default function VehiclesPage() {
  const { vehicles, loading, removeVehicle, setStatus } = useVehicles();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Category | "All">("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(
    () => (tab === "All" ? vehicles : vehicles.filter((v) => v.category === tab)),
    [vehicles, tab]
  );

  async function handleToggleStatus(id: string, currentStatus: string) {
    setBusyId(id);
    try {
      await setStatus(id, currentStatus === "Active" ? "Inactive" : "Active");
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete);
    try {
      await removeVehicle(pendingDelete);
      showToast("Vehicle removed", "success");
    } catch {
      showToast("Failed to delete vehicle", "error");
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Vehicles"
        subtitle="Manage your listed bikes, scooties and cars"
        action={
          <Link href="/vehicles/new" className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={16} /> Add Vehicle
          </Link>
        }
      />

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
            {t.key !== "All" && (
              <span className="ml-1.5 opacity-80">
                ({vehicles.filter((v) => v.category === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title={tab === "All" ? "No vehicles listed yet" : `No ${tab.toLowerCase()}s listed yet`}
          description="Add a vehicle with photos, pricing and specs to start getting bookings from customers."
          action={
            <Link href="/vehicles/new" className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
              <Plus size={16} /> Add Vehicle
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <OwnerVehicleCard
              key={v.id}
              vehicle={v}
              busy={busyId === v.id}
              onToggleStatus={() => handleToggleStatus(v.id, v.status)}
              onDelete={() => setPendingDelete(v.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this vehicle?"
        description="This will permanently delete the listing. This action can't be undone."
        confirmLabel="Delete"
        danger
        busy={busyId === pendingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
