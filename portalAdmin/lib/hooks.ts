"use client";

import { useCallback, useEffect, useState } from "react";
import type { OwnerApprovalStatus, PendingPayment, PlatformStats, ShopOwner, Vehicle, VehicleStatus } from "./types";

export function useStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data: { stats: PlatformStats } = await res.json();
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}

export function useShopOwners(status?: OwnerApprovalStatus) {
  const [owners, setOwners] = useState<ShopOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`/api/shop-owners${qs}`);
      const data: { owners: ShopOwner[] } = await res.json();
      setOwners(data.owners ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { owners, loading, refresh };
}

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

  const setStatus = useCallback(async (id: string, status: VehicleStatus) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update vehicle status");
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  }, []);

  return { vehicles, loading, refresh, setStatus };
}

export function usePayments() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      const data: { payments: PendingPayment[] } = await res.json();
      setPayments(data.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verify = useCallback(async (id: string) => {
    const res = await fetch(`/api/payments/${id}/verify`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to verify payment");
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reject = useCallback(async (id: string, reason: string) => {
    const res = await fetch(`/api/payments/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error("Failed to reject payment");
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { payments, loading, refresh, verify, reject };
}
