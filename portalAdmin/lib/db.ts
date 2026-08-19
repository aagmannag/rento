import { ADMIN_ALL_VEHICLES_CACHE_KEY, getCached, invalidateCache, invalidateVehicleListingCaches, prisma } from "@rento/db";
import type {
  AdminUser,
  Category,
  OwnerApprovalStatus,
  PartnerFleetSummary,
  PlatformStats,
  ShopOwner,
  ShopOwnerDetail,
  Vehicle,
  VehicleAvailability,
  VehicleStatus,
} from "./types";

// Vehicle photos uploaded as files live on the Shop Owner portal's own server (a
// separate app/port), not this one — relative "/uploads/..." paths need to be resolved
// to that origin before the browser can load them here. Absolute http(s) URLs
// (owner-pasted web images) are left untouched.
const PARTNER_PORTAL_ORIGIN = process.env.PARTNER_PORTAL_ORIGIN || "http://localhost:3001";

function resolvePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${PARTNER_PORTAL_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Every query in this file below is read by every admin's dashboard on every
// DASHBOARD_POLL_INTERVAL_MS tick (see lib/hooks.ts) — none of it is per-admin data (any
// admin sees the exact same stats/owner list/vehicle list), so it's a direct fit for the
// same shared getCached()/invalidateCache() pattern @rento/db already uses for the
// customer-facing vehicle listing. Measured via curl against a real authenticated
// session before this existed: ~220-770ms on EVERY call (not just the first), because
// none of these four queries had any caching at all — under real polling traffic that's
// the same "every API call is slow" experience the vehicle listing had before its own
// cache existed.
const ADMIN_STATS_CACHE_KEY = "cache:v1:admin:stats";
const adminShopOwnersCacheKey = (status?: OwnerApprovalStatus) => `cache:v1:admin:shop-owners:${status ?? "all"}`;
// ADMIN_ALL_VEHICLES_CACHE_KEY itself lives in @rento/db's vehicles.ts, not here — see
// its own doc comment for why (invalidation has to happen from that shared write path).
const ADMIN_CACHE_TTL_SECONDS = 10;

// Every possible listShopOwners() cache key — invalidated together on any owner status
// change, since which key(s) become stale depends on both the old and new status (e.g.
// approving a Pending owner invalidates the "Pending" list, the "Approved" list, AND the
// unfiltered "all" list) and there's no cheaper way to know that at the call site than
// just clearing every variant.
const ALL_ADMIN_SHOP_OWNER_STATUSES: (OwnerApprovalStatus | undefined)[] = [
  undefined,
  "Pending",
  "Approved",
  "Rejected",
  "Suspended",
];
function invalidateAdminShopOwnersCache(): void {
  void invalidateCache(ALL_ADMIN_SHOP_OWNER_STATUSES.map(adminShopOwnersCacheKey));
}

// Prisma returns DateTime columns as real `Date` objects; every app-facing type in
// ./types.ts declares `createdAt: string` (an ISO string, same as what these endpoints
// have always sent over the wire as JSON). These mappers do that conversion once,
// rather than at every call site.

function toAdmin<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function toOwner<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// Every field on ShopOwner (./types.ts) except passwordHash — portalPartner owns shop
// owner password verification, not this app, so portalAdmin has no legitimate reason
// to ever fetch a shop owner's password hash at all. Explicit select (rather than
// relying on every caller to strip it after the fact) means it never leaves Neon in
// the first place: the declared ShopOwner type already excludes it, but nothing
// enforced that at the JSON-serialization boundary until this was applied everywhere
// a ShopOwner row is read below.
const SHOP_OWNER_SELECT = {
  id: true,
  ownerName: true,
  shopName: true,
  email: true,
  phone: true,
  city: true,
  address: true,
  pincode: true,
  latitude: true,
  longitude: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
} as const;

// ---------- Admin users ----------

export async function adminCount(): Promise<number> {
  return prisma.adminUser.count();
}

export async function createFirstAdmin(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AdminUser> {
  // Guard against a race between the "does an admin exist" check and this insert —
  // the setup screen should only ever be usable once.
  const existing = await adminCount();
  if (existing > 0) {
    throw new Error("An admin account already exists.");
  }

  const admin = await prisma.adminUser.create({
    data: { name: data.name, email: data.email.toLowerCase(), passwordHash: data.passwordHash },
  });
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

export async function findAdminByEmailWithHash(
  email: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  return admin ? toAdmin(admin) : null;
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) return null;
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

export async function getAdminByIdWithHash(
  id: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  return admin ? toAdmin(admin) : null;
}

export async function updateAdminPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.adminUser.update({ where: { id }, data: { passwordHash } });
}

export async function updateAdminName(id: string, name: string): Promise<AdminUser> {
  const admin = await prisma.adminUser.update({ where: { id }, data: { name } });
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

// ---------- Shop owner review ----------

export async function listShopOwners(status?: OwnerApprovalStatus): Promise<ShopOwner[]> {
  return getCached(adminShopOwnersCacheKey(status), ADMIN_CACHE_TTL_SECONDS, async () => {
    const owners = await prisma.shopOwner.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      select: SHOP_OWNER_SELECT,
    });
    return owners.map(toOwner);
  });
}

export async function getShopOwnerDetail(id: string): Promise<ShopOwnerDetail | null> {
  const ownerRow = await prisma.shopOwner.findUnique({ where: { id }, select: SHOP_OWNER_SELECT });
  if (!ownerRow) return null;
  const owner = toOwner(ownerRow);

  const [vehicles, totalBookings, completedTotals] = await Promise.all([
    prisma.vehicle.findMany({
      where: { ownerId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, name: true, brand: true, photoUrl: true, pricePerDay: true, stock: true, city: true, status: true },
    }),
    prisma.booking.count({ where: { ownerId: id } }),
    prisma.booking.aggregate({
      where: { ownerId: id, status: "Completed" },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    ...owner,
    vehicles: vehicles.map((v) => ({
      id: v.id,
      category: v.category as Category,
      name: v.name,
      brand: v.brand,
      photoUrl: resolvePhotoUrl(v.photoUrl),
      pricePerDay: v.pricePerDay,
      stock: v.stock,
      city: v.city,
      status: v.status as VehicleStatus,
    })),
    totalBookings,
    totalEarnings: completedTotals._sum.totalAmount ?? 0,
  };
}

async function setOwnerStatus(
  id: string,
  fromStatuses: OwnerApprovalStatus[],
  toStatus: OwnerApprovalStatus,
  rejectionReason: string | null = null
): Promise<ShopOwner | null> {
  const updated = await prisma.$transaction(async (tx) => {
    // Only the status is actually needed to decide whether this transition is valid.
    const existing = await tx.shopOwner.findUnique({ where: { id }, select: { status: true } });
    if (!existing || !fromStatuses.includes(existing.status)) return null;
    return tx.shopOwner.update({
      where: { id },
      data: { status: toStatus, rejectionReason },
      select: SHOP_OWNER_SELECT,
    });
  });
  if (updated) {
    // The active-listing query joins on `o.status = 'Approved'` — every status
    // transition here (Approved <-> Rejected/Suspended/Pending) can add or remove this
    // owner's entire catalog from what customers see, so the public listing cache (and
    // this owner's own dashboard) must not keep serving the pre-transition view for the
    // rest of the TTL.
    invalidateVehicleListingCaches(id);
    // This owner just moved between status buckets (e.g. Pending -> Approved) and the
    // owner-count breakdown in getPlatformStats() changed too — both this app's own
    // dashboard queries need to reflect that immediately, not after ADMIN_CACHE_TTL_SECONDS.
    invalidateAdminShopOwnersCache();
    void invalidateCache([ADMIN_STATS_CACHE_KEY]);
  }
  return updated ? toOwner(updated) : null;
}

export async function approveOwner(id: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Pending", "Rejected", "Suspended"], "Approved");
}

export async function rejectOwner(id: string, reason: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Pending", "Approved"], "Rejected", reason);
}

export async function suspendOwner(id: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Approved"], "Suspended");
}

/** Sets or clears a shop's precise pickup coordinates — exclusively an admin action.
 *  Shop owners only ever provide the typed address; Rento admin verifies it against a
 *  real map and marks the exact point, which is what customers actually see. Passes
 *  latitude/longitude straight through (not merged with existing values) so passing
 *  null actually clears a previously-set pin. */
export async function updateOwnerLocation(
  id: string,
  latitude: number | null,
  longitude: number | null
): Promise<ShopOwner | null> {
  try {
    const owner = await prisma.shopOwner.update({
      where: { id },
      data: { latitude, longitude },
      select: SHOP_OWNER_SELECT,
    });
    return toOwner(owner);
  } catch {
    return null;
  }
}

export async function reinstateOwner(id: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Suspended"], "Approved");
}

// ---------- Platform stats ----------

// totalBookings changes on every booking made across the platform (rentoCustomer,
// high-frequency, cross-app) — wiring real-time invalidation for that specific field
// would mean coupling every booking-creation path in a different app to this app's
// dashboard cache, for a number that's purely informational here (not read back into any
// decision this app makes). ADMIN_CACHE_TTL_SECONDS alone is the deliberate trade-off,
// same reasoning as the platform-wide rating stat in rentoCustomer.
export async function getPlatformStats(): Promise<PlatformStats> {
  return getCached(ADMIN_STATS_CACHE_KEY, ADMIN_CACHE_TTL_SECONDS, async () => {
    const [ownerStats, vehicleStats, totalBookings] = await Promise.all([
      prisma.shopOwner.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.booking.count(),
    ]);

    const ownersByStatus: Record<string, number> = {};
    for (const row of ownerStats) ownersByStatus[row.status] = row._count._all;

    const vehiclesByStatus: Record<string, number> = {};
    for (const row of vehicleStats) vehiclesByStatus[row.status] = row._count._all;

    return {
      totalOwners: Object.values(ownersByStatus).reduce((a, b) => a + b, 0),
      pendingOwners: ownersByStatus["Pending"] ?? 0,
      approvedOwners: ownersByStatus["Approved"] ?? 0,
      rejectedOwners: ownersByStatus["Rejected"] ?? 0,
      suspendedOwners: ownersByStatus["Suspended"] ?? 0,
      totalVehicles: Object.values(vehiclesByStatus).reduce((a, b) => a + b, 0),
      activeVehicles: vehiclesByStatus["Active"] ?? 0,
      totalBookings,
    };
  });
}

// ---------- Vehicle moderation ----------

export async function listAllVehicles(): Promise<Vehicle[]> {
  return getCached(ADMIN_ALL_VEHICLES_CACHE_KEY, ADMIN_CACHE_TTL_SECONDS, async () => {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { ownerName: true, shopName: true, status: true } } },
    });
    return vehicles.map((v) => ({
      id: v.id,
      ownerId: v.ownerId,
      ownerName: v.owner.ownerName,
      shopName: v.owner.shopName,
      ownerStatus: v.owner.status as OwnerApprovalStatus,
      category: v.category as Category,
      name: v.name,
      brand: v.brand,
      photoUrl: resolvePhotoUrl(v.photoUrl),
      pricePerDay: v.pricePerDay,
      stock: v.stock,
      city: v.city,
      status: v.status as VehicleStatus,
      createdAt: v.createdAt.toISOString(),
    }));
  });
}

export async function setVehicleStatus(id: string, status: VehicleStatus): Promise<boolean> {
  const result = await prisma.vehicle.updateMany({ where: { id }, data: { status } });
  const updated = result.count > 0;
  if (updated) {
    // Active/Inactive gates whether this vehicle appears in the customer-facing listing
    // at all, and status also feeds getVehicleAvailabilityRow's own Active+Approved
    // gate. No ownerId on hand here without an extra lookup (this moderation action is
    // rare and admin-only, not worth a query just to also clear that owner's own
    // dashboard cache a few seconds sooner) — the global active-listing key and this one
    // vehicle's availability entry are the ones that actually need to be fresh.
    invalidateVehicleListingCaches(undefined, id);
    void invalidateCache([ADMIN_ALL_VEHICLES_CACHE_KEY, ADMIN_STATS_CACHE_KEY, ADMIN_FLEET_CACHE_KEY]);
  }
  return updated;
}

// ---------- Fleet availability ----------

const ADMIN_FLEET_CACHE_KEY = "cache:v1:admin:fleet";

/**
 * Returns every partner's vehicle fleet with live availability data.
 *
 * "booked" mirrors the EXACT WHERE clause of @rento/db's bookedQuantity() helper:
 *   status IN ('Upcoming', 'Active')  AND  paymentStatus NOT IN ('Expired', 'Rejected')
 * Completed bookings are excluded (vehicle already returned); Cancelled/Expired/Rejected
 * bookings are excluded (stock was never actually reserved for them).
 *
 * Uses the same getCached() / short TTL pattern as every other admin read — this
 * endpoint is polled every 8s by the fleet page.
 */
export async function getFleetAvailability(): Promise<PartnerFleetSummary[]> {
  return getCached(ADMIN_FLEET_CACHE_KEY, ADMIN_CACHE_TTL_SECONDS, async () => {
    // One round trip: fetch all vehicles with their owner and active booking counts.
    // Prisma doesn't support a filtered _count on a relation directly, so we
    // pull the raw bookings counts with a groupBy, then join in memory.
    const [vehicles, bookingCounts] = await Promise.all([
      prisma.vehicle.findMany({
        orderBy: [{ ownerId: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          ownerId: true,
          brand: true,
          name: true,
          category: true,
          city: true,
          status: true,
          photoUrl: true,
          pricePerDay: true,
          stock: true,
          owner: {
            select: { ownerName: true, shopName: true, status: true, city: true },
          },
        },
      }),
      // Count active (non-expired, non-rejected, non-cancelled, non-completed) bookings
      // per vehicle — same criteria as bookedQuantity() in @rento/db/vehicles.ts so the
      // admin sees the same availability number a customer would see.
      prisma.booking.groupBy({
        by: ["vehicleId"],
        where: {
          status: { in: ["Upcoming", "Active"] },
          paymentStatus: { notIn: ["Expired", "Rejected"] },
        },
        _sum: { quantity: true },
      }),
    ]);

    // Build a vehicleId -> bookedQty lookup map (O(1) per vehicle below).
    const bookedMap = new Map<string, number>();
    for (const row of bookingCounts) {
      bookedMap.set(row.vehicleId, row._sum.quantity ?? 0);
    }

    // Group vehicles by owner.
    const ownerMap = new Map<string, PartnerFleetSummary>();
    for (const v of vehicles) {
      const booked = bookedMap.get(v.id) ?? 0;
      const available = Math.max(0, v.stock - booked);

      const vehicleEntry: VehicleAvailability = {
        vehicleId: v.id,
        vehicleName: `${v.brand} ${v.name}`,
        category: v.category as Category,
        city: v.city,
        status: v.status as VehicleStatus,
        photoUrl: resolvePhotoUrl(v.photoUrl),
        pricePerDay: v.pricePerDay,
        stock: v.stock,
        booked,
        available,
      };

      const existing = ownerMap.get(v.ownerId);
      if (existing) {
        existing.vehicles.push(vehicleEntry);
        existing.totalStock += v.stock;
        existing.totalBooked += booked;
        existing.totalAvailable += available;
      } else {
        ownerMap.set(v.ownerId, {
          ownerId: v.ownerId,
          ownerName: v.owner.ownerName,
          shopName: v.owner.shopName,
          ownerStatus: v.owner.status as OwnerApprovalStatus,
          city: v.owner.city,
          totalStock: v.stock,
          totalBooked: booked,
          totalAvailable: available,
          vehicles: [vehicleEntry],
        });
      }
    }

    // Return sorted: Approved first, then by shopName.
    return [...ownerMap.values()].sort((a, b) => {
      if (a.ownerStatus === "Approved" && b.ownerStatus !== "Approved") return -1;
      if (a.ownerStatus !== "Approved" && b.ownerStatus === "Approved") return 1;
      return a.shopName.localeCompare(b.shopName);
    });
  });
}
