"use client";

import { useCallback, useEffect, useState } from "react";
import type { Booking, BookingStatus, Vehicle } from "./types";

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles");
      const data: { vehicles: Vehicle[] } = await res.json();
      setVehicles(data.vehicles ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeVehicle = useCallback(async (id: string) => {
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete vehicle");
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const setStatus = useCallback(async (id: string, status: Vehicle["status"]) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update vehicle status");
    const data: { vehicle: Vehicle } = await res.json();
    setVehicles((prev) => prev.map((v) => (v.id === id ? data.vehicle : v)));
  }, []);

  return { vehicles, loading, refresh, removeVehicle, setStatus };
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings");
      const data: { bookings: Booking[] } = await res.json();
      setBookings(data.bookings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = useCallback(async (id: string, status: BookingStatus) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update booking status");
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  return { bookings, loading, refresh, setStatus };
}
