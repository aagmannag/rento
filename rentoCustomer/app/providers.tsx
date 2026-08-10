"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Booking, Category, City, Gender, User, Vehicle } from "@/lib/types";
import {
  getVehiclesFor as staticGetVehiclesFor,
  getVehicleById as staticGetVehicleById,
  getVehicleCountForCity as staticGetVehicleCountForCity,
  getMinPriceForCategory as staticGetMinPriceForCategory,
  TOTAL_VEHICLE_COUNT as STATIC_TOTAL_VEHICLE_COUNT,
} from "@/lib/data";

const BOOKING_CHANNEL = "rento-bookings";

interface ServerUser {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
}

function toUser(server: ServerUser): User {
  return {
    id: server.id,
    phone: server.phone,
    name: server.name,
    gender: (server.gender as Gender | null) ?? undefined,
    city: server.city ?? undefined,
    isLoggedIn: true,
  };
}

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  selectedCity: City | null;
  selectedCategory: Category | null;
  bookings: Booking[];
  setSelectedCity: (city: City) => void;
  setSelectedCategory: (category: Category) => void;
  loginWithServerUser: (serverUser: ServerUser) => void;
  logout: () => void;
  updateProfile: (data: { name?: string; gender?: Gender }) => Promise<void>;
  addBooking: (booking: Booking) => Promise<void>;
  getBooking: (id: string) => Booking | undefined;
  updateBookingLocal: (updated: Booking) => void;
  getAvailableStock: (vehicle: Vehicle) => number;
  /** Fresh, server-authoritative recheck for one vehicle — use right before confirming
   *  a booking, since the merged vehicle list may be a little stale. Returns null if
   *  the check itself fails (network issue etc.), in which case callers should fall
   *  back to the last-known value rather than block the user. */
  refreshVehicleAvailability: (vehicleId: string) => Promise<number | null>;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  /** True until partner-listed vehicles have been fetched at least once. */
  partnerVehiclesLoading: boolean;
  getVehiclesFor: (city: City, category: Category) => Vehicle[];
  getVehicleById: (id: string) => Vehicle | undefined;
  getVehicleCountForCity: (city: City) => number;
  getMinPriceForCategory: (category: Category) => number | null;
  getTotalVehicleCount: () => number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedCity, setSelectedCityState] = useState<City | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState<Category | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [partnerVehicles, setPartnerVehicles] = useState<Vehicle[]>([]);
  const [partnerVehiclesLoading, setPartnerVehiclesLoading] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Vehicles added by shop owners through the Partner portal live in Postgres, not in
  // the static lib/data.ts catalog — fetch them and merge everywhere below so they show
  // up alongside the built-in demo inventory.
  const refreshPartnerVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/partner-vehicles");
      const data: { vehicles: Vehicle[] } = await res.json();
      setPartnerVehicles(data.vehicles ?? []);
    } catch {
      // keep whatever we last had rather than clearing the list on a transient failure
    } finally {
      setPartnerVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPartnerVehicles();
  }, [refreshPartnerVehicles]);

  // Someone else could book the last unit of a vehicle in a different browser/device
  // while this tab sits open — revalidate stock whenever the user comes back to this
  // tab, so availability shown here doesn't go stale for the length of a whole visit.
  useEffect(() => {
    function onFocus() {
      void refreshPartnerVehicles();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshPartnerVehicles]);

  // Session lives in an HTTP-only cookie set by /api/login — restore it on load so
  // a logged-in user stays logged in across refreshes (unlike the rest of this app's
  // session-only state, auth is now backed by a real server session).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { user: ServerUser | null }) => {
        if (!cancelled && data.user) setUser(toUser(data.user));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bookings are persisted server-side per user (see /api/bookings) — (re)load them
  // whenever the logged-in user changes, and clear them on logout.
  useEffect(() => {
    if (!user?.id) {
      setBookings([]);
      return;
    }
    let cancelled = false;
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data: { bookings: Booking[] }) => {
        if (!cancelled) setBookings(data.bookings ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Keep vehicle stock consistent across tabs of the same browser: a booking made
  // in one tab must be reflected in every other open tab's availability count too,
  // otherwise two tabs could independently "win" the same last unit.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BOOKING_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<{ type: "ADD_BOOKING"; booking: Booking }>) => {
      if (event.data?.type !== "ADD_BOOKING") return;
      const incoming = event.data.booking;
      setBookings((prev) => (prev.some((b) => b.id === incoming.id) ? prev : [incoming, ...prev]));
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const setSelectedCity = useCallback((city: City) => {
    setSelectedCityState(city);
    setSelectedCategoryState(null);
  }, []);

  const setSelectedCategory = useCallback((category: Category) => {
    setSelectedCategoryState(category);
  }, []);

  // Called after the client has already verified the phone number with Firebase and
  // the resulting ID token has been exchanged for our own session via /api/login.
  const loginWithServerUser = useCallback((serverUser: ServerUser) => {
    setUser(toUser(serverUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    fetch("/api/logout", { method: "POST" }).catch(() => {});
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; gender?: Gender }) => {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update profile");
    const { user: updated } = (await res.json()) as { user: ServerUser };
    setUser(toUser(updated));
  }, []);

  const addBooking = useCallback(async (booking: Booking) => {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to save booking");
    }
    const { booking: saved } = (await res.json()) as { booking: Booking };
    setBookings((prev) => [saved, ...prev]);
    channelRef.current?.postMessage({ type: "ADD_BOOKING", booking: saved });
  }, []);

  const getBooking = useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings]
  );

  const updateBookingLocal = useCallback((updated: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  // availableStock is computed server-side from ALL Upcoming bookings for this vehicle
  // across every customer/browser/session — not just whatever bookings this particular
  // session happens to have loaded — so it stays correct regardless of who else is
  // booking the same vehicle at the same time.
  const getAvailableStock = useCallback((vehicle: Vehicle) => vehicle.availableStock, []);

  const refreshVehicleAvailability = useCallback(async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/vehicle-availability/${vehicleId}`);
      if (!res.ok) return null;
      const data: { availableStock: number } = await res.json();
      setPartnerVehicles((prev) =>
        prev.map((v) => (v.id === vehicleId ? { ...v, availableStock: data.availableStock } : v))
      );
      return data.availableStock;
    } catch {
      return null;
    }
  }, []);

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  const getVehiclesFor = useCallback(
    (city: City, category: Category) => [
      ...staticGetVehiclesFor(city, category),
      ...partnerVehicles.filter((v) => v.city === city && v.category === category),
    ],
    [partnerVehicles]
  );

  const getVehicleById = useCallback(
    (id: string) => staticGetVehicleById(id) ?? partnerVehicles.find((v) => v.id === id),
    [partnerVehicles]
  );

  const getVehicleCountForCity = useCallback(
    (city: City) =>
      staticGetVehicleCountForCity(city) +
      partnerVehicles.filter((v) => v.city === city).reduce((sum, v) => sum + v.stock, 0),
    [partnerVehicles]
  );

  const getMinPriceForCategory = useCallback(
    (category: Category): number | null => {
      const staticMin = staticGetMinPriceForCategory(category);
      const partnerPrices = partnerVehicles
        .filter((v) => v.category === category)
        .map((v) => v.pricePerDay);
      if (!partnerPrices.length) return staticMin;
      return staticMin === null ? Math.min(...partnerPrices) : Math.min(staticMin, ...partnerPrices);
    },
    [partnerVehicles]
  );

  const getTotalVehicleCount = useCallback(
    () => STATIC_TOTAL_VEHICLE_COUNT + partnerVehicles.reduce((sum, v) => sum + v.stock, 0),
    [partnerVehicles]
  );

  const value = useMemo(
    () => ({
      user,
      authLoading,
      selectedCity,
      selectedCategory,
      bookings,
      setSelectedCity,
      setSelectedCategory,
      loginWithServerUser,
      logout,
      updateProfile,
      addBooking,
      getBooking,
      updateBookingLocal,
      getAvailableStock,
      refreshVehicleAvailability,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      partnerVehiclesLoading,
      getVehiclesFor,
      getVehicleById,
      getVehicleCountForCity,
      getMinPriceForCategory,
      getTotalVehicleCount,
    }),
    [
      user,
      authLoading,
      selectedCity,
      selectedCategory,
      bookings,
      setSelectedCity,
      setSelectedCategory,
      loginWithServerUser,
      logout,
      updateProfile,
      addBooking,
      getBooking,
      updateBookingLocal,
      getAvailableStock,
      refreshVehicleAvailability,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      partnerVehiclesLoading,
      getVehiclesFor,
      getVehicleById,
      getVehicleCountForCity,
      getMinPriceForCategory,
      getTotalVehicleCount,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
