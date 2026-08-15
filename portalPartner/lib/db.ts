import {
  getCached,
  invalidateCustomerBookingsCache,
  invalidateCustomerUserCache,
  invalidateOwnerBookingsCache,
  invalidateVehicleListingCaches,
  listVehiclesForOwnerWithAvailability,
  ownerBookingsCacheKey,
  PENDING_HOLD_MINUTES,
  Prisma,
  prisma,
} from "@rento/db";
import type {
  Booking,
  BookingStatus,
  Category,
  FuelType,
  ShopOwner,
  Transmission,
  Vehicle,
  VehicleStatus,
} from "./types";

// Prisma returns DateTime columns as real `Date` objects; ShopOwner (./types.ts)
// declares `createdAt: string` (an ISO string, same as what these endpoints have
// always sent over the wire as JSON) — convert once here rather than at every call site.
function toOwner<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// ---------- Shop owners ----------

export async function createShopOwner(data: {
  ownerName: string;
  shopName: string;
  email: string;
  passwordHash: string;
  phone: string;
  city: string;
  address: string;
  pincode: string | null;
}): Promise<ShopOwner> {
  const owner = await prisma.shopOwner.create({
    data: {
      ownerName: data.ownerName,
      shopName: data.shopName,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      phone: data.phone,
      city: data.city,
      address: data.address,
      pincode: data.pincode,
    },
  });
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function findOwnerByEmailWithHash(
  email: string
): Promise<(ShopOwner & { passwordHash: string }) | null> {
  const owner = await prisma.shopOwner.findUnique({ where: { email: email.toLowerCase() } });
  return owner ? toOwner(owner) : null;
}

export async function getOwnerById(id: string): Promise<ShopOwner | null> {
  const owner = await prisma.shopOwner.findUnique({ where: { id } });
  if (!owner) return null;
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function updateOwnerProfile(
  id: string,
  data: { ownerName?: string; shopName?: string; phone?: string; city?: string; address?: string; pincode?: string | null }
): Promise<ShopOwner> {
  const owner = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopOwner.findUniqueOrThrow({ where: { id } });
    // The precise pin is set exclusively by Rento admin, verified against the address
    // text at the time they set it. If the owner then edits that text, the old pin may
    // no longer match the new address — clear it so the shop shows a plain geocoded
    // fallback instead of a silently-stale "verified" pin, until admin re-confirms.
    const addressChanged = data.address !== undefined && data.address !== existing.address;
    return tx.shopOwner.update({
      where: { id },
      data: {
        ownerName: data.ownerName ?? undefined,
        shopName: data.shopName ?? undefined,
        phone: data.phone ?? undefined,
        city: data.city ?? undefined,
        address: data.address ?? undefined,
        // Matches the original COALESCE-based update: a null/undefined pincode is a
        // no-op (can't explicitly clear it this way), any other value is applied as-is.
        pincode: data.pincode === undefined || data.pincode === null ? undefined : data.pincode,
        latitude: addressChanged ? null : undefined,
        longitude: addressChanged ? null : undefined,
      },
    });
  });
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function updateOwnerPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.shopOwner.update({ where: { id }, data: { passwordHash } });
}

/** After a rejection, lets the owner send their (presumably updated) profile back for review. */
export async function resubmitOwnerForReview(id: string): Promise<ShopOwner | null> {
  const owner = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopOwner.findUnique({ where: { id } });
    if (!existing || existing.status !== "Rejected") return null;
    return tx.shopOwner.update({
      where: { id },
      data: { status: "Pending", rejectionReason: null },
    });
  });
  if (!owner) return null;
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

// ---------- Vehicles ----------

function toVehicle(row: {
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
}): Vehicle {
  return {
    id: row.id,
    ownerId: row.ownerId,
    category: row.category as Category,
    name: row.name,
    brand: row.brand,
    engineLabel: row.engineLabel,
    photoUrl: row.photoUrl,
    photoUrls: row.photoUrls?.length ? row.photoUrls : row.photoUrl ? [row.photoUrl] : [],
    pricePerDay: row.pricePerDay,
    pricePerHour: row.pricePerHour,
    securityDeposit: row.securityDeposit,
    stock: row.stock,
    specs: {
      fuel: row.fuel as FuelType,
      transmission: row.transmission as Transmission,
      seats: row.seats,
      mileage: row.mileage,
    },
    features: row.features ?? [],
    description: row.description,
    city: row.city,
    status: row.status as VehicleStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createVehicle(data: {
  ownerId: string;
  category: Category;
  name: string;
  brand: string;
  engineLabel: string;
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
}): Promise<Vehicle> {
  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: data.ownerId,
      category: data.category,
      name: data.name,
      brand: data.brand,
      engineLabel: data.engineLabel,
      photoUrl: data.photoUrls[0] ?? null,
      photoUrls: data.photoUrls,
      pricePerDay: data.pricePerDay,
      pricePerHour: data.pricePerHour,
      securityDeposit: data.securityDeposit,
      stock: data.stock,
      fuel: data.fuel,
      transmission: data.transmission,
      seats: data.seats,
      mileage: data.mileage,
      features: data.features,
      description: data.description,
      city: data.city,
    },
  });
  // A brand-new Active listing must show up in rentoCustomer's public listing (and this
  // owner's own dashboard) without waiting out the cache's TTL.
  invalidateVehicleListingCaches(data.ownerId, vehicle.id);
  return toVehicle(vehicle);
}

export async function getVehiclesForOwner(ownerId: string): Promise<Vehicle[]> {
  // One round trip for every vehicle + its booked quantity (a LATERAL join), instead of
  // one query for the vehicle list plus a separate query per vehicle to compute
  // availability — see @rento/db's listVehiclesForOwnerWithAvailability.
  const rows = await listVehiclesForOwnerWithAvailability(ownerId);
  return rows.map((row) => ({
    ...toVehicle(row),
    availableStock: Math.max(0, row.stock - Number(row.booked)),
  }));
}

export async function getVehicleForOwner(id: string, ownerId: string): Promise<Vehicle | null> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerId } });
  return vehicle ? toVehicle(vehicle) : null;
}

export async function updateVehicle(
  id: string,
  ownerId: string,
  data: Partial<{
    category: Category;
    name: string;
    brand: string;
    engineLabel: string;
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
    status: VehicleStatus;
  }>
): Promise<Vehicle | null> {
  const vehicle = await prisma.$transaction(async (tx) => {
    const existing = await tx.vehicle.findFirst({ where: { id, ownerId } });
    if (!existing) return null;
    return tx.vehicle.update({
      where: { id },
      data: {
        category: data.category ?? undefined,
        name: data.name ?? undefined,
        brand: data.brand ?? undefined,
        engineLabel: data.engineLabel ?? undefined,
        photoUrls: data.photoUrls ?? undefined,
        photoUrl: data.photoUrls ? data.photoUrls[0] ?? null : undefined,
        pricePerDay: data.pricePerDay ?? undefined,
        pricePerHour: data.pricePerHour ?? undefined,
        securityDeposit: data.securityDeposit ?? undefined,
        stock: data.stock ?? undefined,
        fuel: data.fuel ?? undefined,
        transmission: data.transmission ?? undefined,
        seats: data.seats ?? undefined,
        mileage: data.mileage ?? undefined,
        features: data.features ?? undefined,
        // Same COALESCE-quirk as pincode above: null/undefined is a no-op.
        description: data.description === undefined || data.description === null ? undefined : data.description,
        city: data.city ?? undefined,
        status: data.status ?? undefined,
      },
    });
  });
  // Price, stock, status (Active/Inactive), photos — every field a customer-facing
  // listing or this owner's own dashboard shows can change here.
  if (vehicle) invalidateVehicleListingCaches(ownerId, id);
  return vehicle ? toVehicle(vehicle) : null;
}

export async function deleteVehicle(id: string, ownerId: string): Promise<boolean> {
  const result = await prisma.vehicle.deleteMany({ where: { id, ownerId } });
  const deleted = result.count > 0;
  if (deleted) invalidateVehicleListingCaches(ownerId, id);
  return deleted;
}

// ---------- Bookings ----------

/** Only a Completed+Verified booking can ever have a CustomerRating — shared by the
 *  list-attach below and submitCustomerRating() so both agree exactly. */
function isRateable(row: { status: string; paymentStatus: string }): boolean {
  return row.status === "Completed" && row.paymentStatus === "Verified";
}

/**
 * Measured via RequestTimer/slow-query logging (same investigation, same fix shape as
 * rentoCustomer's getBookingsForUser — see its doc comment): this endpoint was doing
 * THREE sequential round trips — an unconditional stale-hold-expiry UPDATE that ran on
 * every single dashboard load regardless of whether anything was actually stale, then
 * the main bookings query, then a ratings query that could only start once the main
 * query's ids were known. That sequencing was costing ~1.2-1.7s warm (vs ~250ms for the
 * structurally identical rentoCustomer endpoint before its own fix).
 *
 * Two changes close the gap:
 *  1. CustomerRating is now fetched by `ownerId` directly (a column it already carries)
 *     in parallel with the main query, instead of waiting to learn which booking ids
 *     are eligible — same trick as rentoCustomer's fix.
 *  2. Stale-hold expiry is now computed lazily in application code from the rows this
 *     request already fetched (mirroring rentoCustomer's tryExpirePendingHold), and
 *     only issues a scoped UPDATE for the specific rows found stale — not a blanket
 *     sweep every time. In the common case (nothing stale), that round trip is skipped
 *     entirely rather than always paid for.
 *  3. `include: { vehicle: ... }` looked like a single JOIN but isn't one — Prisma's
 *     default relation-loading strategy runs it as a second query keyed off the ids the
 *     main query just returned, which is itself a sequential dependency (confirmed via
 *     slow-query logging: a `vehicles WHERE id IN (...)` query landing right after the
 *     bookings query, every request). Since Vehicle already carries an indexed
 *     `ownerId`, fetching this owner's vehicles the same way as the ratings — by
 *     `ownerId`, in the same parallel wave — removes that dependency too.
 */
// Measured via curl against a real authenticated session: ~235-305ms on EVERY call, not
// just the first — this endpoint had no caching at all. Owner-scoped, same TTL as the
// vehicle listing cache — and for the same reason bumped from 5s to 15s: this app's own
// dashboard poll (POLL_INTERVAL_MS in lib/hooks.ts) fires every 10s, so a 5s TTL meant
// every scheduled poll landed after the entry had already expired, missing the cache on
// every single tick instead of the near-0ms hit it exists to provide. The lazy
// stale-hold-expiry write inside the function body below only actually runs on a cache
// miss now, rather than on every call — that's fine: it's a display-only correction
// (see its own comment), not something bookedQuantity's availability math depends on, so
// a few extra seconds' delay here is the same trade-off this codebase already makes for
// the identical flip in rentoCustomer's tryExpirePendingHold.
// ownerBookingsCacheKey/invalidateOwnerBookingsCache live in @rento/db's booking.ts, not
// here — a new booking is created from that shared write path (reached from
// rentoCustomer), so invalidation has to happen from there to cross the app boundary.
const OWNER_BOOKINGS_CACHE_TTL_SECONDS = 15;

export async function getBookingsForOwner(ownerId: string): Promise<Booking[]> {
  return getCached(ownerBookingsCacheKey(ownerId), OWNER_BOOKINGS_CACHE_TTL_SECONDS, () =>
    fetchBookingsForOwner(ownerId)
  );
}

async function fetchBookingsForOwner(ownerId: string): Promise<Booking[]> {
  const [bookings, ratings, vehicles] = await Promise.all([
    prisma.booking.findMany({
      where: { ownerId },
      orderBy: { pickupDateTime: "desc" },
      select: {
        id: true,
        ownerId: true,
        vehicleId: true,
        customerName: true,
        customerPhone: true,
        pickupDateTime: true,
        returnDateTime: true,
        quantity: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        utrNumber: true,
        createdAt: true,
      },
    }),
    prisma.customerRating.findMany({
      where: { ownerId },
      select: { partnerBookingId: true, stars: true, comment: true },
    }),
    prisma.vehicle.findMany({
      where: { ownerId },
      select: { id: true, name: true, photoUrl: true },
    }),
  ]);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const staleIds = bookings
    .filter(
      (b) =>
        b.status === "Upcoming" &&
        b.paymentStatus === "Pending" &&
        Date.now() - b.createdAt.getTime() >= PENDING_HOLD_MINUTES * 60_000
    )
    .map((b) => b.id);
  if (staleIds.length) {
    await prisma.booking.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "Cancelled", paymentStatus: "Expired" },
    });
    const staleIdSet = new Set(staleIds);
    for (const b of bookings) {
      if (staleIdSet.has(b.id)) {
        b.status = "Cancelled";
        b.paymentStatus = "Expired";
      }
    }
  }

  const ratingByBookingId = new Map(ratings.map((r) => [r.partnerBookingId, r]));

  return bookings.map((b) => {
    // Vehicle.onDelete: Cascade from Booking means a booking can never outlive its
    // vehicle in practice — this fallback exists purely so a TS-safe Map lookup doesn't
    // need a non-null assertion, not because this is expected to happen.
    const vehicle = vehicleById.get(b.vehicleId);
    return {
    id: b.id,
    ownerId: b.ownerId,
    vehicleId: b.vehicleId,
    vehicleName: vehicle?.name ?? "Vehicle",
    vehiclePhotoUrl: vehicle?.photoUrl ?? null,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    pickupDateTime: b.pickupDateTime.toISOString(),
    returnDateTime: b.returnDateTime.toISOString(),
    quantity: b.quantity,
    totalAmount: b.totalAmount,
    status: b.status as BookingStatus,
    paymentStatus: b.paymentStatus as Booking["paymentStatus"],
    utrNumber: b.utrNumber,
    createdAt: b.createdAt.toISOString(),
    customerRating: isRateable(b) ? (ratingByBookingId.get(b.id) ?? null) : undefined,
    };
  });
}

const COMMENT_MAX_LENGTH = 500;

function isValidStars(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function sanitizeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, COMMENT_MAX_LENGTH);
}

export interface SubmitCustomerRatingResult {
  ok: boolean;
  error?: string;
  rating?: { stars: number; comment: string | null };
}

/**
 * Records the shop owner's rating of the customer for a Completed+Verified booking.
 * Resolves the target rentoCustomer User via Booking.userId (set at creation time for
 * every booking made after the ratings feature shipped); falls back to a phone-number
 * lookup against users.phone for bookings created before that column existed, since
 * customerPhone was always populated from the authenticated customer's own phone at
 * booking time. Transactionally increments User.ratingSum/ratingCount alongside the
 * insert — same "load-bearing, not cosmetic" reasoning as rentoCustomer's
 * submitPartnerRating incrementing ShopOwner's aggregate.
 */
export async function submitCustomerRating(
  bookingId: string,
  ownerId: string,
  starsInput: unknown,
  commentInput: unknown
): Promise<SubmitCustomerRatingResult> {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, ownerId } });
  if (!booking) return { ok: false, error: "Booking not found" };
  if (!isRateable(booking)) {
    return { ok: false, error: "This booking isn't eligible for rating yet." };
  }
  if (!isValidStars(starsInput)) {
    return { ok: false, error: "Choose a star rating from 1 to 5." };
  }
  const comment = sanitizeComment(commentInput);
  // A comment is mandatory for anything below a perfect 5-star rating — the UI
  // enforces this too (see RateCustomerDialog.tsx), but a request that skips the
  // client must not be able to submit a low rating with no explanation.
  if (starsInput < 5 && !comment) {
    return { ok: false, error: "Please add a comment explaining your rating before submitting." };
  }

  const targetUserId =
    booking.userId ??
    (await prisma.user.findUnique({ where: { phone: booking.customerPhone }, select: { id: true } }))?.id;
  if (!targetUserId) {
    return { ok: false, error: "This customer's account could not be found, so a rating can't be recorded." };
  }

  try {
    await prisma.$transaction([
      prisma.customerRating.create({
        data: { partnerBookingId: booking.id, ownerId, userId: targetUserId, stars: starsInput, comment },
      }),
      prisma.user.update({
        where: { id: targetUserId },
        data: { ratingSum: { increment: starsInput }, ratingCount: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You've already rated this customer for this booking." };
    }
    throw err;
  }

  // getBookingsForOwner() attaches this rating to its matching booking row — without
  // this, the owner's own dashboard would keep showing "not yet rated" on the booking
  // they just rated for up to OWNER_BOOKINGS_CACHE_TTL_SECONDS.
  invalidateOwnerBookingsCache(ownerId);
  // The ratingSum/ratingCount increment above just changed what rentoCustomer's
  // getUserById (cached, see customerUserCacheKey's doc comment) would return for this
  // customer — without this, their own /api/me poll would keep showing their pre-rating
  // average for up to CUSTOMER_USER_CACHE_TTL_SECONDS.
  invalidateCustomerUserCache(targetUserId);

  return { ok: true, rating: { stars: starsInput, comment } };
}

export async function updateBookingStatus(
  id: string,
  ownerId: string,
  status: BookingStatus
): Promise<boolean> {
  const result = await prisma.booking.updateMany({ where: { id, ownerId }, data: { status } });
  const updated = result.count > 0;

  if (updated) {
    // Moving a booking out of Upcoming (Completed or Cancelled) releases whatever units
    // it was holding — bookedQuantity only counts status = 'Upcoming' rows — so the
    // vehicle's available stock just changed and the listing caches showing it are now
    // stale. The status change itself is also what getBookingsForOwner() would return
    // differently now, so that cache needs to go too.
    invalidateVehicleListingCaches(ownerId);
    invalidateOwnerBookingsCache(ownerId);
  }

  // Best-effort: reflect the change back into the customer's own booking record too
  // (a different app's table, rentoCustomer/customer_bookings, in this same database)
  // — otherwise a customer's "My Bookings" page would show "Upcoming" forever even
  // after the shop owner marks the rental Completed or Cancelled.
  if (updated) {
    try {
      // userId first, not returned by updateMany, so the cache entry rentoCustomer
      // reads (see invalidateCustomerBookingsCache's own doc comment) can actually be
      // targeted — otherwise this cross-app write would leave that customer's own
      // /api/bookings poll showing the pre-update status for up to its TTL.
      const affected = await prisma.customerBooking.findMany({
        where: { partnerBookingId: id },
        select: { userId: true },
      });
      await prisma.customerBooking.updateMany({
        where: { partnerBookingId: id },
        data: { status },
      });
      for (const { userId } of affected) invalidateCustomerBookingsCache(userId);
    } catch (err) {
      console.error("Failed to sync booking status back to rentoCustomer:", err);
    }
  }

  return updated;
}
