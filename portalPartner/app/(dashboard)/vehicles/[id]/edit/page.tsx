"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import VehicleForm from "@/components/VehicleForm";
import type { Vehicle } from "@/lib/types";

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/vehicles/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data: { vehicle: Vehicle } = await res.json();
        if (!cancelled) setVehicle(data.vehicle);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">This vehicle couldn&apos;t be found.</p>
        <button onClick={() => router.push("/vehicles")} className="btn-primary mt-4 px-5 py-2.5 text-sm">
          Back to My Vehicles
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Edit vehicle" subtitle={`${vehicle.brand} ${vehicle.name}`} />
      <div className="max-w-3xl">
        <VehicleForm mode="edit" vehicle={vehicle} />
      </div>
    </div>
  );
}
