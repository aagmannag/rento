"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Booking, Category, City, Gender, User, Vehicle } from "@/lib/types";
import { usePolling } from "@/lib/usePolling";
import {
  getVehiclesFor as staticGetVehiclesFor,
  getVehicleById as staticGetVehicleById,
  getVehicleCountForCity as staticGetVehicleCountForCity,
  getMinPriceForCategory as staticGetMinPriceForCategory,
  TOTAL_VEHICLE_COUNT as STATIC_TOTAL_VEHICLE_COUNT,
} from "@/lib/data";

const BOOKING_CHANNEL = "rento-bookings";

export interface DisplayRating {
  value: number;
  count: number;
  isDynamic: boolean;
}

// Matches @rento/db's PLATFORM_RATING_STATIC_DEFAULT — shown until the real fetch
// below resolves, so the homepage never flashes a "0" or a loading state for this.
const DEFAULT_PLATFORM_RATING: DisplayRating = { value: 4.7, count: 0, isDynamic: false };

interface ServerUser {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
  rating?: { value: number; count: number } | null;
}

function toUser(server: ServerUser): User {
  return {
    id: server.id,
    phone: server.phone,
    name: server.name,
    gender: (server.gender as Gender | null) ?? undefined,
    city: server.city ?? undefined,
    isLoggedIn: true,
    rating: server.rating ?? null,
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
  /** True until the first /api/bookings fetch for the current user has settled — lets
   *  pages like the confirmation page tell "not loaded yet" apart from "genuinely not
   *  found" instead of flashing a not-found error before the list arrives. */
  bookingsLoading: boolean;
  /** Set when the last /api/bookings fetch failed (network error, non-401 non-ok
   *  response) — lets My Bookings show a real error + retry instead of silently
   *  rendering "no bookings yet", which would otherwise look identical to a genuinely
   *  empty account. Cleared on the next successful fetch. */
  bookingsError: string | null;
  /** Re-runs the /api/bookings fetch for the current user (e.g. a "Retry" button after
   *  bookingsError, or any other spot that wants a fresh read of the whole list). */
  refetchBookings: () => void;
  /** Live, server-authoritative re-fetch of one booking (applies lazy payment-hold
   *  expiry server-side) — merges the result into `bookings`. Returns null on any
   *  failure (network issue, not found, not authenticated), in which case callers
   *  should keep showing whatever's already cached rather than treat it as gone. */
  refreshBooking: (id: string) => Promise<Booking | null>;
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
  /** The platform-wide rating shown on the homepage — static seed until 20 real
   *  PlatformRating submissions, then a live computed average. */
  platformRating: DisplayRating;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedCity, setSelectedCityState] = useState<City | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState<Category | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  // Bumped by refetchBookings() to force the bookings-load effect below to re-run even
  // though user?.id hasn't changed (a plain retry, not a login/logout).
  const [reloadBookingsToken, setReloadBookingsToken] = useState(0);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [partnerVehicles, setPartnerVehicles] = useState<Vehicle[]>([]);
  const [partnerVehiclesLoading, setPartnerVehiclesLoading] = useState(true);
  const [platformRating, setPlatformRating] = useState<DisplayRating>(DEFAULT_PLATFORM_RATING);
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Guards against both duplicate concurrent requests (a fetch already in flight, e.g.
  // two focus/visibilitychange events firing back-to-back for one tab switch) and
  // needless repeats within the server's own cache window (see the 5s TTL in
  // getPartnerVehicles()) — refetching sooner than that can't return anything new.
  const lastFetchedAtRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const MIN_REFETCH_INTERVAL_MS = 5_000;
  // Bumped by every bookings fetch (loadBookings, refreshBooking) AND every local
  // mutation (addBooking, updateBookingLocal) — a fetch's response is only applied to
  // state if nothing has superseded it since the fetch was issued. Without this, a
  // background poll response landing just after e.g. a rating submission's
  // updateBookingLocal() could briefly revert the confirmation page's "already rated"
  // state back to blank until the next poll corrects it (the fetch that started before
  // the mutation has no way to know about it).
  const bookingsRequestSeqRef = useRef(0);

  // Vehicles added by shop owners through the Partner portal live in Postgres, not in
  // the static lib/data.ts catalog — fetch them and merge everywhere below so they show
  // up alongside the built-in demo inventory.
  const refreshPartnerVehicles = useCallback(async (options?: { force?: boolean }) => {
    if (fetchInFlightRef.current) return;
    if (!options?.force && Date.now() - lastFetchedAtRef.current < MIN_REFETCH_INTERVAL_MS) return;

    fetchInFlightRef.current = true;
    try {
      const res = await fetch("/api/partner-vehicles");
      const data: { vehicles: Vehicle[] } = await res.json();
      setPartnerVehicles(data.vehicles ?? []);
      lastFetchedAtRef.current = Date.now();
    } catch {
      // keep whatever we last had rather than clearing the list on a transient failure
    } finally {
      fetchInFlightRef.current = false;
      setPartnerVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPartnerVehicles({ force: true });
  }, [refreshPartnerVehicles]);

  // Public, unauthenticated, fetched once — logged-out visitors see the homepage stat
  // too. Falls back to keeping the static default on any failure rather than blocking
  // or showing an error, since this is a marketing stat, not critical data.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform-rating")
      .then((res) => res.json())
      .then((data: { rating: DisplayRating }) => {
        if (!cancelled && data.rating) setPlatformRating(data.rating);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Someone else could book the last unit of a vehicle in a different browser/device
  // while this tab sits open — revalidate stock whenever the user comes back to this
  // tab, so availability shown here doesn't go stale for the length of a whole visit.
  // Throttled (see MIN_REFETCH_INTERVAL_MS above): switching tabs back and forth
  // rapidly, or the focus + visibilitychange events both firing for one switch,
  // shouldn't turn into a burst of identical requests.
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

  // Background sync while the tab stays open and focused: a vehicle's stock/price/
  // rating, or a brand-new listing, can change from a completely different customer's
  // booking or a shop owner's edit at any moment. usePolling's own throttle (10s) sits
  // comfortably above refreshPartnerVehicles' internal MIN_REFETCH_INTERVAL_MS (5s), so
  // this never fights with the focus-triggered refresh above — whichever fires first
  // in a given window wins, the other is a no-op via that same throttle.
  usePolling(useCallback(() => refreshPartnerVehicles(), [refreshPartnerVehicles]), 10_000, true);

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

  // Background sync for the logged-in user's own profile — mainly so a rating a shop
  // owner submits about this customer (see the profile page's "Your rating from shop
  // owners") shows up while they're sitting on that page, without a reload. Lower
  // priority than bookings/vehicles (name/gender/phone don't change from outside this
  // tab), hence the longer interval. Unlike the initial-load effect above, a null
  // `data.user` here — the session cookie expiring or being cleared mid-session — DOES
  // clear local `user` state, consistent with how the bookings poll's 401 handling
  // already treats that as a real logout rather than silently going stale.
  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/me");
    const data: { user: ServerUser | null } = await res.json();
    setUser(data.user ? toUser(data.user) : null);
  }, []);
  usePolling(refreshMe, 20_000, Boolean(user?.id));

  // The actual /api/bookings fetch, shared by the initial-load effect below and by
  // the background poll further down. `silent: true` (used for polling) skips the
  // loading/error UI state entirely — a background refresh must never flash a spinner
  // over the page or show an error banner for one missed tick; it just quietly retries
  // next interval. The 401-recovery and "keep stale data on failure" behavior apply
  // either way, since those are correctness concerns, not just initial-load UX.
  const loadBookings = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.id) return;
      const seq = ++bookingsRequestSeqRef.current;
      if (!options?.silent) {
        setBookingsLoading(true);
        setBookingsError(null);
      }
      try {
        const res = await fetch("/api/bookings");
        if (res.status === 401) {
          // The client still thinks it's logged in, but the session cookie has expired
          // or been cleared server-side (long-open tab, cookies wiped elsewhere, etc.)
          // — without this, the request below would just return no bookings and the
          // page would show "no bookings yet", indistinguishable from actually having
          // none. Correcting `user` here instead makes every "logged in" page react
          // the same way it would to an explicit logout (e.g. prompting a fresh login).
          // Authoritative regardless of request ordering, so not gated on `seq`.
          setUser(null);
          setBookings([]);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
        const data: { bookings: Booking[] } = await res.json();
        if (seq === bookingsRequestSeqRef.current) setBookings(data.bookings ?? []);
      } catch (err) {
        if (!options?.silent) {
          setBookingsError("Couldn't load your bookings. Check your connection and try again.");
        }
        if (options?.silent) throw err; // let usePolling's own catch swallow/log it
      } finally {
        if (!options?.silent) setBookingsLoading(false);
      }
    },
    [user?.id]
  );

  // Bookings are persisted server-side per user (see /api/bookings) — (re)load them
  // whenever the logged-in user changes, and clear them on logout.
  useEffect(() => {
    if (!user?.id) {
      setBookings([]);
      setBookingsError(null);
      setBookingsLoading(false);
      return;
    }
    void loadBookings();
  }, [user?.id, reloadBookingsToken, loadBookings]);

  // Background sync: another portal (a shop owner marking a booking Completed, an
  // admin verifying/rejecting a payment) can change a booking this tab is displaying
  // at any moment — poll so My Bookings and the confirmation page pick that up without
  // the customer needing to manually reload. Disabled while logged out (nothing to poll).
  usePolling(useCallback(() => loadBookings({ silent: true }), [loadBookings]), 10_000, Boolean(user?.id));

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
    bookingsRequestSeqRef.current++; // invalidate any in-flight refresh so it can't drop this
    setBookings((prev) => [saved, ...prev]);
    channelRef.current?.postMessage({ type: "ADD_BOOKING", booking: saved });
  }, []);

  const getBooking = useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings]
  );

  const updateBookingLocal = useCallback((updated: Booking) => {
    bookingsRequestSeqRef.current++;
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const refetchBookings = useCallback(() => {
    setReloadBookingsToken((t) => t + 1);
  }, []);

  const refreshBooking = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`);
      if (!res.ok) return null;
      const data: { booking: Booking } = await res.json();
      bookingsRequestSeqRef.current++; // this fetch's result is now the freshest known state
      setBookings((prev) =>
        prev.some((b) => b.id === data.booking.id)
          ? prev.map((b) => (b.id === data.booking.id ? data.booking : b))
          : [data.booking, ...prev]
      );
      return data.booking;
    } catch {
      return null;
    }
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
      bookingsLoading,
      bookingsError,
      refetchBookings,
      refreshBooking,
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
      platformRating,
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
      bookingsLoading,
      bookingsError,
      refetchBookings,
      refreshBooking,
      platformRating,
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
