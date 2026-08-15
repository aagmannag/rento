"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Fuel, MapPin, Pencil, Trash2, Users, Zap } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { CategoryPhotoPlaceholder } from "./CategoryIcon";

export default function OwnerVehicleCard({
  vehicle,
  onToggleStatus,
  onDelete,
  busy,
}: {
  vehicle: Vehicle;
  onToggleStatus: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  // A photo can fail to load for reasons outside our control — an expired external
  // link, a network hiccup — falling back to the category icon keeps the card
  // looking intentional instead of showing a broken-image icon forever.
  const [photoBroken, setPhotoBroken] = useState(false);

  return (
    <div className="card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="relative h-40 bg-secondary">
        {vehicle.photoUrl && !photoBroken ? (
          <Image
            src={vehicle.photoUrl}
            alt={vehicle.name}
            fill
            sizes="(max-width: 640px) 100vw, 25vw"
            className="object-cover"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          <CategoryPhotoPlaceholder category={vehicle.category} size={48} />
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={vehicle.status} />
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-600 text-white backdrop-blur">
          {vehicle.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-sm font-700 text-foreground">{vehicle.name}</h3>
        <p className="truncate text-xs text-muted-foreground">{vehicle.brand} · {vehicle.engineLabel || vehicle.specs.transmission}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Fuel size={12} /> {vehicle.specs.fuel}</span>
          <span className="flex items-center gap-1"><Zap size={12} /> {vehicle.specs.mileage}</span>
          {vehicle.category === "Car" && (
            <span className="flex items-center gap-1"><Users size={12} /> {vehicle.specs.seats} seats</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {vehicle.city}
          </span>
          {vehicle.availableStock !== undefined ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-700 ${
                vehicle.availableStock <= 0
                  ? "bg-red-50 text-red-600"
                  : vehicle.availableStock < vehicle.stock
                  ? "bg-amber-50 text-amber-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {vehicle.availableStock <= 0
                ? "Fully booked"
                : `${vehicle.availableStock} of ${vehicle.stock} available`}
            </span>
          ) : (
            <span>{vehicle.stock} unit{vehicle.stock > 1 ? "s" : ""}</span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-base font-800 text-foreground">
              ₹{vehicle.pricePerDay}<span className="text-xs font-600 text-muted-foreground">/day</span>
            </p>
            <p className="text-xs font-600 text-primary">or ₹{vehicle.pricePerHour}/hr</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleStatus}
              disabled={busy}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-700 text-foreground transition hover:border-primary disabled:opacity-50"
              title={vehicle.status === "Active" ? "Set inactive" : "Set active"}
            >
              {vehicle.status === "Active" ? "Deactivate" : "Activate"}
            </button>
            <Link
              href={`/vehicles/${vehicle.id}/edit`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-primary hover:text-primary"
              aria-label="Edit vehicle"
            >
              <Pencil size={14} />
            </Link>
            <button
              onClick={onDelete}
              disabled={busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-red-500 hover:text-red-500 disabled:opacity-50"
              aria-label="Delete vehicle"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
