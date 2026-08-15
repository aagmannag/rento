"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnerApprovalStatus, PendingPayment, PlatformStats, ShopOwner, Vehicle, VehicleStatus } from "./types";
import { usePolling } from "./usePolling";

// How often each list re-syncs with the server while its page is open and visible —
// see usePolling's doc comment for why this is polling rather than push, and why the
// payments queue in particular needs it (two admins can be looking at it at once).
const POLL_INTERVAL_MS = 8_000;

export function useStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
      const data: { stats: PlatformStats } = await res.json();
      setStats(data.stats ?? null);
    } catch (err) {
      // A non-ok response or a malformed/empty body (e.g. mid-compile on a fresh dev
      // server, or a transient network blip) must not crash the whole dashboard — keep
      // whatever stats were last shown rather than throwing an unhandled error.
      console.error("Failed to load platform stats:", err);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  return { stats, loading, refresh };
}

export function useShopOwners(status?: OwnerApprovalStatus) {
  const [owners, setOwners] = useState<ShopOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const qs = status ? `?status=${status}` : "";
        const res = await fetch(`/api/shop-owners${qs}`);
        if (!res.ok) throw new Error(`Failed to load shop owners (${res.status})`);
        const data: { owners: ShopOwner[] } = await res.json();
        setOwners(data.owners ?? []);
      } catch (err) {
        // Same reasoning as useStats() above — keep the last-known list rather than
        // crashing on a non-ok or malformed response.
        console.error("Failed to load shop owners:", err);
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [status]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  return { owners, loading, refresh };
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped by every refresh AND every optimistic mutation below — a refresh response
  // is only applied if nothing has superseded it since it was issued. Without this, a
  // poll's response landing just after this admin's own setStatus() call could briefly
  // revert that same-moment change back to its old value until the next poll corrects
  // it (the fetch that started before the mutation has no way to know about it).
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++requestSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error(`Failed to load vehicles (${res.status})`);
      const data: { vehicles: Vehicle[] } = await res.json();
      if (seq === requestSeqRef.current) setVehicles(data.vehicles ?? []);
    } catch (err) {
      // Same reasoning as useStats() above.
      console.error("Failed to load vehicles:", err);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  const setStatus = useCallback(async (id: string, status: VehicleStatus) => {
    requestSeqRef.current++; // invalidate any in-flight refresh so it can't clobber this
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
  // See useVehicles() above for why this exists — here it also guards against the
  // more likely case of two different admins acting on this same queue concurrently.
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++requestSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error(`Failed to load payments (${res.status})`);
      const data: { payments: PendingPayment[] } = await res.json();
      if (seq === requestSeqRef.current) setPayments(data.payments ?? []);
    } catch (err) {
      // Same reasoning as useStats() above.
      console.error("Failed to load payments:", err);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  const verify = useCallback(async (id: string) => {
    requestSeqRef.current++;
    const res = await fetch(`/api/payments/${id}/verify`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to verify payment");
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reject = useCallback(async (id: string, reason: string) => {
    requestSeqRef.current++;
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
