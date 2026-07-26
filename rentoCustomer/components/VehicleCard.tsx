"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Fuel, Zap, Users, ArrowRight } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import Stars from "./Stars";
import { useApp } from "@/app/providers";

export default function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { getAvailableStock } = useApp();
  const availableUnits = getAvailableStock(vehicle);
  const soldOut = availableUnits <= 0;
  // A photo can fail to load for reasons outside our control — an expired external
  // link, a network hiccup, a misconfigured host — falling back to the category emoji
  // keeps the card looking intentional instead of showing a broken-image icon forever.
  const [photoBroken, setPhotoBroken] = useState(false);

  return (
    <div
      data-testid={`vehicle-card-${vehicle.id}`}
      className={`card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card ${
        soldOut ? "opacity-75" : ""
      }`}
    >
      <div className="relative flex h-48 items-center justify-center bg-secondary text-7xl">
        {vehicle.photo && !photoBroken ? (
          <Image
            src={vehicle.photo}
            alt={vehicle.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          vehicle.image
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-700 text-white ${
            soldOut ? "bg-red-500" : "bg-green-600"
          }`}
        >
          ● {soldOut ? "Sold Out" : `${availableUnits} Available`}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-600 text-white backdrop-blur">
          {vehicle.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-700 text-foreground">{vehicle.name}</h3>
            <p className="text-xs text-muted-foreground">
              {vehicle.brand} · {vehicle.engineLabel}
            </p>
          </div>
          <Stars rating={vehicle.rating} count={vehicle.ratingCount} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Fuel size={13} /> {vehicle.specs.fuel}
          </span>
          <span className="flex items-center gap-1">
            <Zap size={13} /> {vehicle.specs.mileage}
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} /> {vehicle.specs.seats} seats
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-600 text-muted-foreground">
            <MapPin size={12} /> {vehicle.shop.name}
          </span>
          {vehicle.stock > 1 && (
            <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[11px] font-600 text-muted-foreground">
              {vehicle.stock} units at this shop
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-lg font-800 text-foreground">
              ₹{vehicle.pricePerDay}
              <span className="text-xs font-600 text-muted-foreground">/day</span>
            </p>
            <p className="text-xs font-600 text-primary">or ₹{vehicle.pricePerHour}/hr</p>
            <p className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-600 text-muted-foreground">
              + ₹{vehicle.securityDeposit} deposit at shop
            </p>
          </div>

          {!soldOut ? (
            <Link
              href={`/vehicles/${vehicle.id}`}
              className="btn-primary flex items-center gap-1 px-4 py-2 text-xs"
            >
              Book <ArrowRight size={13} />
            </Link>
          ) : (
            <span className="flex cursor-not-allowed items-center gap-1 rounded-lg bg-muted px-4 py-2 text-xs font-600 text-muted-foreground">
              Book <ArrowRight size={13} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
