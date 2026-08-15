import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { getCached, invalidateCache } from "./cache";
import { PENDING_HOLD_MINUTES } from "./constants";

// Availability is a moving target — every Upcoming booking ties up stock, and holds
// release automatically after PENDING_HOLD_MINUTES — so this cache's TTL has to stay
// short regardless of how it's backed. Must still comfortably exceed the fastest poll
// interval reading it (rentoCustomer's partner-vehicles poll and portalPartner's own
// vehicles poll are both 10s — see their respective providers.tsx/lib/hooks.ts) —
// this was previously 5s, which meant every single scheduled poll tick landed *after*
// the entry had already expired, missing the cache 100% of the time instead of the
// near-0ms hit this cache exists to provide. 15s keeps a wide safety margin above both
// pollers while still bounding staleness to a handful of seconds.
const LISTING_CACHE_TTL_SECONDS = 15;
const ACTIVE_VEHICLES_CACHE_KEY = "cache:v1:vehicles:active";
const ownerVehiclesCacheKey = (ownerId: string) => `cache:v1:vehicles:owner:${ownerId}`;
// portalAdmin's vehicle-moderation view (listAllVehicles) shows every vehicle regardless
// of shop/vehicle status — it goes stale on the exact same set of writes as the two keys
// above, just with a broader "every vehicle, every status" scope. The key itself is
// consumed by portalAdmin/lib/db.ts (imported from here rather than duplicated as a
// literal string, so the two can never drift apart) — it lives here, not there, because
// invalidation has to happen from this shared write path, the same reasoning
// ownerVehiclesCacheKey above already follows for portalPartner's own dashboard.
export const ADMIN_ALL_VEHICLES_CACHE_KEY = "cache:v1:admin:vehicles:all";
const vehicleAvailabilityCacheKey = (vehicleId: string) => `cache:v1:vehicles:avail:${vehicleId}`;
// Deliberately much shorter than LISTING_CACHE_TTL_SECONDS: this backs
// getVehicleAvailabilityRow(), the pre-booking stock check that's meant to be fresher
// than the public listing (see its own doc comment). 2s is short enough that it can't
// meaningfully weaken that freshness guarantee — the codebase's own design already
// tolerates this check being "a request or two stale under heavy concurrent load", since
// the real, race-proof check is the locked transaction in createBookingForVehicle — but
// it's enough to absorb the common case of one booking flow calling this endpoint
// multiple times in quick succession (page mount, then again right before confirming).
const AVAILABILITY_CACHE_TTL_SECONDS = 2;

/**
 * Call after any write that changes what listActivePartnerVehiclesWithAvailability(),
 * listVehiclesForOwnerWithAvailability(), or getVehicleAvailabilityRow() would return: a
 * new/edited/deleted vehicle, a booking created/cancelled/expired/completed (all move
 * booked-quantity), or a shop owner's approval status changing (gates the active-listing
 * JOIN's `o.status = 'Approved'` filter). Passing `ownerId` also clears that owner's own
 * dashboard listing; passing `vehicleId` also clears that one vehicle's short-TTL
 * availability entry. Omit either when the write doesn't cleanly resolve to one
 * owner/vehicle (e.g. a shop-wide approval-status change touches every vehicle it owns)
 * — an omitted entry just falls back to its own TTL, which is at most a few seconds of
 * staleness on a narrower view, not a correctness issue the way stale public availability
 * would be.
 */
export function invalidateVehicleListingCaches(ownerId?: string, vehicleId?: string): void {
  const keys = [ACTIVE_VEHICLES_CACHE_KEY, ADMIN_ALL_VEHICLES_CACHE_KEY];
  if (ownerId) keys.push(ownerVehiclesCacheKey(ownerId));
  if (vehicleId) keys.push(vehicleAvailabilityCacheKey(vehicleId));
  void invalidateCache(keys);
}

// The single dominant cost on every request that touches vehicle availability is
// network round trips to Neon (measured ~150-190ms each from a dev machine on the
// other side of the world from eu-west-2 — server-side query execution itself is
// sub-millisecond even unindexed at today's data volume). The functions in this file
// exist specifically to fold what used to be "1 query + N per-vehicle queries" into a
// single round trip via a LATERAL join, computing each vehicle's booked quantity in
// the same query as the vehicle/owner fetch instead of one query per vehicle.

export interface VehicleWithAvailabilityRow {
  id: string;
  ownerId: string;
  category: string;
  name: string;
  brand: string;
  engineLabel: string;
  photoUrl: string | null;
  photoUrls: string[];
  pricePerDay: number;
  pricePerHour: number;
  securityDeposit: number;
  stock: number;
  fuel: string;
  transmission: string;
  seats: number;
  mileage: string;
  features: string[];
  description: string | null;
  city: string;
  status: string;
  createdAt: Date;
  booked: bigint;
  shopName: string;
  shopAddress: string;
  shopLatitude: number | null;
  shopLongitude: number | null;
  shopRatingSum: number;
  shopRatingCount: number;
}

const VEHICLE_WITH_SHOP_COLUMNS = Prisma.sql`
  v.id, v.owner_id AS "ownerId", v.category, v.name, v.brand, v.engine_label AS "engineLabel",
  v.photo_url AS "photoUrl", v.photo_urls AS "photoUrls", v.price_per_day AS "pricePerDay",
  v.price_per_hour AS "pricePerHour", v.security_deposit AS "securityDeposit", v.stock,
  v.fuel, v.transmission, v.seats, v.mileage, v.features, v.description, v.city, v.status,
  v.created_at AS "createdAt", COALESCE(bq.booked, 0) AS booked,
  o.shop_name AS "shopName", o.address AS "shopAddress",
  o.latitude AS "shopLatitude", o.longitude AS "shopLongitude",
  o.rating_sum AS "shopRatingSum", o.rating_count AS "shopRatingCount"
`;

// Same "what actually holds a unit" rule everywhere else in the app: Submitted/Verified
// payments always hold it, a Pending payment only holds it for PENDING_HOLD_MINUTES
// (abandoned checkouts release automatically), Rejected never holds it. Previously
// hardcoded to a literal 30-minute interval here while booking.ts's bookedQuantity/
// createBookingForVehicle (the *authoritative* availability check, re-verified
// atomically at booking time) used PENDING_HOLD_MINUTES = 5 — the two had drifted apart,
// so a listing could keep showing a vehicle as unavailable for up to 25 minutes after
// its hold had already actually expired. Sharing the one constant is what keeps that
// from happening again.
const BOOKED_LATERAL = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(b.quantity), 0) AS booked
    FROM bookings b
    WHERE b.vehicle_id = v.id AND b.status = 'Upcoming'
      AND (
        b.payment_status IN ('Submitted', 'Verified')
        OR (b.payment_status = 'Pending' AND b.created_at > now() - interval '1 minute' * ${PENDING_HOLD_MINUTES})
      )
  ) bq ON true
`;

/** Every Active vehicle from an Approved shop, with availability — one round trip (or,
 *  far more often under real traffic, zero: see the shared Redis cache in ./cache). */
export async function listActivePartnerVehiclesWithAvailability(): Promise<VehicleWithAvailabilityRow[]> {
  return getCached(ACTIVE_VEHICLES_CACHE_KEY, LISTING_CACHE_TTL_SECONDS, () =>
    prisma.$queryRaw<VehicleWithAvailabilityRow[]>`
      SELECT ${VEHICLE_WITH_SHOP_COLUMNS}
      FROM vehicles v
      JOIN shop_owners o ON o.id = v.owner_id
      ${BOOKED_LATERAL}
      WHERE v.status = 'Active' AND o.status = 'Approved'
      ORDER BY v.created_at DESC
    `
  );
}

/** Every vehicle belonging to one owner, with availability — one round trip (or, far
 *  more often under real traffic, zero: see the shared Redis cache in ./cache). */
export async function listVehiclesForOwnerWithAvailability(ownerId: string): Promise<VehicleWithAvailabilityRow[]> {
  return getCached(ownerVehiclesCacheKey(ownerId), LISTING_CACHE_TTL_SECONDS, () =>
    prisma.$queryRaw<VehicleWithAvailabilityRow[]>`
      SELECT ${VEHICLE_WITH_SHOP_COLUMNS}
      FROM vehicles v
      JOIN shop_owners o ON o.id = v.owner_id
      ${BOOKED_LATERAL}
      WHERE v.owner_id = ${ownerId}::uuid
      ORDER BY v.created_at DESC
    `
  );
}

export interface VehicleAvailabilityRow {
  id: string;
  stock: number;
  booked: bigint;
}

/** A single vehicle's stock + booked quantity, gated by the same Active+Approved check
 *  as the listing above — one round trip (or, far more often under real traffic, zero:
 *  see the shared Redis cache in ./cache) instead of two. */
export async function getVehicleAvailabilityRow(vehicleId: string): Promise<VehicleAvailabilityRow | null> {
  return getCached(vehicleAvailabilityCacheKey(vehicleId), AVAILABILITY_CACHE_TTL_SECONDS, async () => {
    const rows = await prisma.$queryRaw<VehicleAvailabilityRow[]>`
      SELECT v.id, v.stock, COALESCE(bq.booked, 0) AS booked
      FROM vehicles v
      JOIN shop_owners o ON o.id = v.owner_id
      ${BOOKED_LATERAL}
      WHERE v.id = ${vehicleId}::uuid AND v.status = 'Active' AND o.status = 'Approved'
    `;
    return rows[0] ?? null;
  });
}
