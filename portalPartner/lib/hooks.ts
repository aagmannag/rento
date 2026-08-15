"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Booking, BookingStatus, Vehicle } from "./types";
import { usePolling } from "./usePolling";

// How often each list re-syncs with the server while its page is open and visible.
// Short enough that changes made elsewhere (a customer booking, an admin verifying a
// payment, this same owner editing from another tab/device) show up without a manual
// reload; long enough not to be a meaningful load on a small app like this one.
const POLL_INTERVAL_MS = 10_000;

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped by every refresh AND every optimistic mutation below — a refresh response
  // is only applied if nothing has superseded it since it was issued. Without this, a
  // background poll's response landing just after this owner's own removeVehicle()/
  // setStatus() call could briefly revert or resurrect that same-moment change until
  // the next poll corrects it (the fetch that started before the mutation has no way
  // to know about it).
  const requestSeqRef = useRef(0);

  // `silent` skips the loading-spinner state — a background poll must never flash a
  // spinner over a list the owner is actively looking at; it just quietly updates the
  // data in place. Failures during a silent refresh are swallowed by usePolling itself.
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++requestSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error(`Failed to load vehicles (${res.status})`);
      const data: { vehicles: Vehicle[] } = await res.json();
      if (seq === requestSeqRef.current) setVehicles(data.vehicles ?? []);
    } catch (err) {
      // A non-ok response or a malformed/empty body (e.g. mid-compile on a fresh dev
      // server, or a transient network blip) must not crash the whole page — keep
      // whatever list was last shown rather than throwing an unhandled error.
      console.error("Failed to load vehicles:", err);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  const removeVehicle = useCallback(async (id: string) => {
    requestSeqRef.current++; // invalidate any in-flight refresh so it can't clobber this
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete vehicle");
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const setStatus = useCallback(async (id: string, status: Vehicle["status"]) => {
    requestSeqRef.current++;
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
  // See useVehicles() above for why this exists.
  const requestSeqRef = useRef(0);

  // `silent` skips the loading-spinner state — see useVehicles() above for why.
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++requestSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
      const data: { bookings: Booking[] } = await res.json();
      if (seq === requestSeqRef.current) setBookings(data.bookings ?? []);
    } catch (err) {
      // Same reasoning as useVehicles() above.
      console.error("Failed to load bookings:", err);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Background sync: a customer booking this owner's vehicle, an admin verifying or
  // rejecting a payment, or this same owner acting from a different tab/device can all
  // change this list at any moment — poll so it shows up without a manual reload.
  usePolling(useCallback(() => refresh({ silent: true }), [refresh]), POLL_INTERVAL_MS);

  const setStatus = useCallback(async (id: string, status: BookingStatus) => {
    requestSeqRef.current++;
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update booking status");
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const rateCustomer = useCallback(async (id: string, stars: number, comment: string) => {
    requestSeqRef.current++;
    const res = await fetch(`/api/bookings/${id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, comment: comment || undefined }),
    });
    // Parsed separately from the res.ok check below: a non-ok response's body isn't
    // guaranteed to be valid JSON (or present at all) either, so a parse failure here
    // must not mask the real "request failed" error with a raw SyntaxError instead.
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to submit rating");
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, customerRating: data.rating } : b)));
  }, []);

  return { bookings, loading, refresh, setStatus, rateCustomer };
}
