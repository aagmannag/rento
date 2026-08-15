import {
  customerBookingsCacheKey,
  CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS,
  customerUserCacheKey,
  CUSTOMER_USER_CACHE_TTL_SECONDS,
  getCached,
  invalidateCustomerBookingsCache,
  invalidateCustomerUserCache,
  invalidatePlatformRatingCache,
  invalidateVehicleListingCaches,
  isPendingHoldExpired,
  Prisma,
  prisma,
} from "@rento/db";
import { syncPartnerBookingExpiry } from "./partnerDb";
import { quoteRefund, customerCancelBlockReason, type RefundQuote } from "./cancellationPolicy";
import { isValidUtrFormat } from "./utr";
import type { Booking, BookingRating } from "./types";

export interface DbUser {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
  created_at: string;
  /** null until this customer has received at least one CustomerRating — deliberately
   *  no static seed/threshold here (see the User model's doc comment): a personal stat,
   *  not a public trust signal that needs to avoid looking empty. */
  rating: { value: number; count: number } | null;
}

function toDbUser(row: {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
  createdAt: Date;
  ratingSum: number;
  ratingCount: number;
}): DbUser {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    gender: row.gender,
    city: row.city,
    created_at: row.createdAt.toISOString(),
    rating:
      row.ratingCount > 0 ? { value: Math.round((row.ratingSum / row.ratingCount) * 10) / 10, count: row.ratingCount } : null,
  };
}

/** Finds a user by phone, creating one on first login (matches the "create if new" flow). */
export async function findOrCreateUserByPhone(phone: string): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return toDbUser(existing);

  // Race-safe: if two requests for a brand-new phone number land at once, one insert
  // wins and the other hits the unique constraint — fall back to reading the row the
  // winner just created rather than surfacing a 500.
  try {
    const created = await prisma.user.create({ data: { phone, name: "Rento User" } });
    return toDbUser(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.user.findUnique({ where: { phone } });
      if (row) return toDbUser(row);
    }
    throw err;
  }
}

// Polled every 20s per logged-in tab (see providers.tsx's refreshMe) — was hitting Neon
// on every single call before this, unlike every other hot read in this app. Also read
// by portalPartner's submitCustomerRating cross-app (see customerUserCacheKey's own
// doc comment for why the key builder lives in @rento/db).
export async function getUserById(id: string): Promise<DbUser | null> {
  return getCached(customerUserCacheKey(id), CUSTOMER_USER_CACHE_TTL_SECONDS, async () => {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toDbUser(row) : null;
  });
}

export async function updateUserProfile(
  id: string,
  data: { name?: string; gender?: string; city?: string }
): Promise<DbUser> {
  const row = await prisma.user.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      gender: data.gender ?? undefined,
      city: data.city ?? undefined,
    },
  });
  // Otherwise the edit wouldn't show up in this same tab's own /api/me poll for up to
  // CUSTOMER_USER_CACHE_TTL_SECONDS.
  invalidateCustomerUserCache(id);
  return toDbUser(row);
}

function toBooking(row: {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleImage: string | null;
  vehiclePhoto: string | null;
  city: string;
  category: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string | null;
  shopLatitude: number | null;
  shopLongitude: number | null;
  rentalMode: string;
  pickupDateTime: Date;
  returnDateTime: Date;
  days: number;
  hours: number;
  quantity: number;
  pricePerDay: number;
  pricePerHour: number;
  rentalCost: number;
  securityDeposit: number;
  totalPayableOnline: number;
  totalPayableAtShop: number;
  status: string;
  paymentStatus: string;
  utrNumber: string | null;
  paymentScreenshotUrl: string | null;
  paymentNote: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  refundPercent: number | null;
  refundAmount: number | null;
}): Booking {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicleName: row.vehicleName,
    vehicleImage: row.vehicleImage ?? "",
    vehiclePhoto: row.vehiclePhoto ?? undefined,
    city: row.city as Booking["city"],
    category: row.category as Booking["category"],
    shop: {
      name: row.shopName,
      address: row.shopAddress,
      phone: row.shopPhone,
      latitude: row.shopLatitude,
      longitude: row.shopLongitude,
    },
    rentalMode: row.rentalMode as Booking["rentalMode"],
    pickupDateTime: row.pickupDateTime.toISOString(),
    returnDateTime: row.returnDateTime.toISOString(),
    days: row.days,
    hours: row.hours,
    quantity: row.quantity,
    pricePerDay: row.pricePerDay,
    pricePerHour: row.pricePerHour,
    rentalCost: row.rentalCost,
    securityDeposit: row.securityDeposit,
    totalPayableOnline: row.totalPayableOnline,
    totalPayableAtShop: row.totalPayableAtShop,
    status: row.status as Booking["status"],
    paymentStatus: row.paymentStatus as Booking["paymentStatus"],
    utrNumber: row.utrNumber ?? undefined,
    paymentScreenshotUrl: row.paymentScreenshotUrl ?? undefined,
    paymentNote: row.paymentNote,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: (row.cancelledBy as Booking["cancelledBy"]) ?? null,
    refundPercent: row.refundPercent,
    refundAmount: row.refundAmount,
  };
}

/** Persists a booking made by a logged-in customer. */
export async function createCustomerBooking(
  userId: string,
  booking: Booking,
  partnerBookingId: string | null
): Promise<Booking> {
  const row = await prisma.customerBooking.create({
    data: {
      id: booking.id,
      userId,
      vehicleId: booking.vehicleId,
      vehicleName: booking.vehicleName,
      vehicleImage: booking.vehicleImage || null,
      vehiclePhoto: booking.vehiclePhoto ?? null,
      city: booking.city,
      category: booking.category,
      shopName: booking.shop.name,
      shopAddress: booking.shop.address,
      shopPhone: booking.shop.phone ?? null,
      shopLatitude: booking.shop.latitude ?? null,
      shopLongitude: booking.shop.longitude ?? null,
      rentalMode: booking.rentalMode,
      pickupDateTime: booking.pickupDateTime,
      returnDateTime: booking.returnDateTime,
      days: booking.days,
      hours: booking.hours,
      quantity: booking.quantity,
      pricePerDay: booking.pricePerDay,
      pricePerHour: booking.pricePerHour,
      rentalCost: booking.rentalCost,
      securityDeposit: booking.securityDeposit,
      totalPayableOnline: booking.totalPayableOnline,
      totalPayableAtShop: booking.totalPayableAtShop,
      status: booking.status,
      partnerBookingId,
    },
  });
  // Otherwise this customer's own /api/bookings poll would keep showing the pre-booking
  // list for up to CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS right after they just booked.
  invalidateCustomerBookingsCache(userId);
  return toBooking(row);
}

/**
 * Race-safe lazy expiry: if this row is a Pending booking whose payment hold window
 * has elapsed, flips it to Cancelled/Expired and best-effort mirrors that into the
 * shop owner's own ledger (see syncPartnerBookingExpiry). Called from every read path
 * below so no caller ever sees a stale "still on hold" status past its actual
 * deadline — no separate cron/worker needed, since the *availability* calculation
 * (bookedQuantity) already excludes stale-Pending rows purely by time regardless of
 * whether this flip has happened yet; this only affects what status the row itself
 * reports back to the customer.
 *
 * The update is scoped to `status: "Upcoming", paymentStatus: "Pending"` rather than
 * just `id`, so a request that races with the customer submitting a UTR moments
 * before the deadline can't clobber a real payment — if `updateMany` matches zero
 * rows, something else already changed this booking, and the caller should treat the
 * row as unchanged.
 */
async function tryExpirePendingHold<
  T extends { id: string; status: string; paymentStatus: string; createdAt: Date; partnerBookingId: string | null }
>(row: T): Promise<T> {
  if (row.status !== "Upcoming" || row.paymentStatus !== "Pending" || !isPendingHoldExpired(row.createdAt)) {
    return row;
  }

  const result = await prisma.customerBooking.updateMany({
    where: { id: row.id, status: "Upcoming", paymentStatus: "Pending" },
    data: { status: "Cancelled", paymentStatus: "Expired" },
  });
  if (result.count === 0) return row;

  if (row.partnerBookingId) {
    await syncPartnerBookingExpiry(row.partnerBookingId);
  }
  // Cast needed because TS can't verify an object literal built from the generic
  // constraint satisfies the caller's more specific T — safe here since we only ever
  // override the two fields the constraint itself declares.
  return { ...row, status: "Cancelled", paymentStatus: "Expired" } as T;
}

// Exactly the columns toBooking() reads, plus partnerBookingId — needed internally by
// tryExpirePendingHold() above to mirror an expiry into the shop owner's ledger, but
// deliberately not read by toBooking() itself (paymentSubmittedAt/paymentVerifiedAt
// are the only fields genuinely trimmed off the wire as internal-only bookkeeping).
const BOOKING_LIST_SELECT = {
  id: true,
  vehicleId: true,
  vehicleName: true,
  vehicleImage: true,
  vehiclePhoto: true,
  city: true,
  category: true,
  shopName: true,
  shopAddress: true,
  shopPhone: true,
  shopLatitude: true,
  shopLongitude: true,
  rentalMode: true,
  pickupDateTime: true,
  returnDateTime: true,
  days: true,
  hours: true,
  quantity: true,
  pricePerDay: true,
  pricePerHour: true,
  rentalCost: true,
  securityDeposit: true,
  totalPayableOnline: true,
  totalPayableAtShop: true,
  status: true,
  paymentStatus: true,
  utrNumber: true,
  paymentScreenshotUrl: true,
  paymentNote: true,
  createdAt: true,
  cancelledAt: true,
  cancelledBy: true,
  refundPercent: true,
  refundAmount: true,
  partnerBookingId: true,
} as const;

/**
 * Measured via RequestTimer/slow-query logging (each round trip to Neon costs
 * ~200-280ms from a typical dev/prod distance to its region, regardless of how simple
 * the query is — see packages/db/src/client.ts's own comment on this): fetching the
 * rating rows only after knowing which booking ids are eligible turned this into two
 * *sequential* round trips (main query, then the rating pair), nearly doubling this
 * endpoint's latency. Filtering PartnerRating/PlatformRating by `userId` directly
 * (a column they carry for exactly this reason) instead of by the not-yet-known
 * booking-id list removes that dependency, so all three queries fire in one parallel
 * wave — one round trip's worth of latency instead of two. The extra rows this can
 * fetch (a customer's ratings for bookings outside the current page, though this
 * endpoint has no pagination today so that doesn't apply) are cheap: this table is
 * bounded by how many bookings one customer has ever completed, not overall traffic.
 */
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
  return getCached(customerBookingsCacheKey(userId), CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS, () =>
    fetchBookingsForUser(userId)
  );
}

async function fetchBookingsForUser(userId: string): Promise<Booking[]> {
  const [rows, partnerRatings, platformRatings] = await Promise.all([
    prisma.customerBooking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: BOOKING_LIST_SELECT,
    }),
    prisma.partnerRating.findMany({
      where: { userId },
      select: { customerBookingId: true, stars: true, comment: true },
    }),
    prisma.platformRating.findMany({
      where: { userId },
      select: { customerBookingId: true, stars: true, comment: true },
    }),
  ]);

  const fresh = await Promise.all(rows.map(tryExpirePendingHold));
  const bookings = fresh.map(toBooking);

  const partnerByBookingId = new Map(partnerRatings.map((r) => [r.customerBookingId, r]));
  const platformByBookingId = new Map(platformRatings.map((r) => [r.customerBookingId, r]));
  for (const booking of bookings) {
    if (isRateable(booking)) {
      booking.partnerRating = partnerByBookingId.get(booking.id) ?? null;
      booking.platformRating = platformByBookingId.get(booking.id) ?? null;
    }
  }

  return bookings;
}

/** Raw row (includes fields like partnerBookingId that the public Booking shape
 *  omits) — shared by getBookingForUser() and submitBookingPayment() so a caller that
 *  needs both (see the payment route) only has to fetch it once. */
export async function getBookingRowForUser(id: string, userId: string) {
  const row = await prisma.customerBooking.findFirst({ where: { id, userId } });
  return row ? tryExpirePendingHold(row) : null;
}

/** Only Completed+Verified bookings can ever have ratings, so this is both the read-side
 *  eligibility check (whether to bother fetching rating rows at all) and the
 *  write-side eligibility check reused by submitPartnerRating/submitPlatformRating —
 *  keeping both in one place means they can never drift apart. */
function isRateable(row: { status: string; paymentStatus: string }): boolean {
  return row.status === "Completed" && row.paymentStatus === "Verified";
}

async function attachRatings(booking: Booking, customerBookingId: string): Promise<Booking> {
  if (!isRateable(booking)) return booking;
  const [partnerRating, platformRating] = await Promise.all([
    prisma.partnerRating.findUnique({
      where: { customerBookingId },
      select: { stars: true, comment: true },
    }),
    prisma.platformRating.findUnique({
      where: { customerBookingId },
      select: { stars: true, comment: true },
    }),
  ]);
  return { ...booking, partnerRating, platformRating };
}

/**
 * Same "fire the rating lookups in parallel using an already-known id, rather than
 * waiting to learn it from the main query" fix as getBookingsForUser() above — this is
 * the confirmation page's single-booking fetch, hit on every page load and on every
 * background poll (see providers.tsx), so the same doubled-round-trip cost applied
 * here too. Firing both rating lookups unconditionally (rather than only once eligibility
 * is known, as attachRatings() above still does for the lower-traffic post-submission
 * callers) means paying for two extra tiny indexed-by-primary-key lookups even on
 * bookings that turn out not to be rateable — but since they run in parallel with the
 * main query, that costs no extra wall-clock time at all, unlike the sequential version.
 */
export async function getBookingForUser(id: string, userId: string): Promise<Booking | null> {
  const [row, partnerRating, platformRating] = await Promise.all([
    getBookingRowForUser(id, userId),
    prisma.partnerRating.findUnique({ where: { customerBookingId: id }, select: { stars: true, comment: true } }),
    prisma.platformRating.findUnique({ where: { customerBookingId: id }, select: { stars: true, comment: true } }),
  ]);
  if (!row) return null;
  const booking = toBooking(row);
  if (isRateable(booking)) {
    booking.partnerRating = partnerRating;
    booking.platformRating = platformRating;
  }
  return booking;
}

export function isValidUtr(value: string): boolean {
  return isValidUtrFormat(value);
}

export interface SubmitPaymentResult {
  ok: boolean;
  error?: string;
  booking?: Booking;
  partnerBookingId?: string | null;
}

/**
 * Records the customer's claimed UPI payment (UTR + optional screenshot). Works for
 * both the first submission (Pending -> Submitted) and resubmission after a rejection
 * (Rejected -> Submitted) — the caller is responsible for re-checking availability
 * before calling this in the resubmission case, since a rejected booking's unit was
 * released back to the pool.
 *
 * `existing` must come from getBookingRowForUser() for this same booking+user, fetched
 * by the caller moments earlier — that already-scoped (WHERE id AND userId) lookup is
 * reused instead of re-querying it here, since the payment route needs the same row
 * anyway (to decide whether a Rejected resubmission needs an availability recheck).
 */
export async function submitBookingPayment(
  existing: NonNullable<Awaited<ReturnType<typeof getBookingRowForUser>>>,
  utrNumber: string,
  screenshotUrl: string | null
): Promise<SubmitPaymentResult> {
  if (existing.paymentStatus === "Verified") {
    return { ok: false, error: "This booking's payment is already verified." };
  }

  // Defense in depth — the route layer already checks this (getBookingRowForUser lazily
  // flips a stale Pending row to Expired before returning it), but a caller that skips
  // that check must not be able to attach a real payment to a hold that's already gone.
  // Unlike Rejected, there's no resubmission path here: the unit may already belong to
  // someone else, so re-checking availability wouldn't be enough to make this safe.
  if (existing.paymentStatus === "Expired" || existing.status === "Cancelled") {
    return {
      ok: false,
      error: "This booking's 5-minute payment window has expired. Please make a new booking.",
    };
  }

  const trimmedUtr = utrNumber.trim();
  if (!isValidUtr(trimmedUtr)) {
    return {
      ok: false,
      error:
        "Enter a valid transaction reference: UPI is 12 digits, IMPS is 12-16 digits, NEFT is 16 alphanumeric characters, RTGS is 22 alphanumeric characters.",
    };
  }

  // A UTR that's already attached to a different Submitted/Verified booking is either a
  // mistake or an attempt to reuse one real payment as proof for multiple bookings.
  const dupe = await prisma.customerBooking.findFirst({
    where: { utrNumber: trimmedUtr, id: { not: existing.id }, paymentStatus: { in: ["Submitted", "Verified"] } },
    select: { id: true },
  });
  if (dupe) {
    return { ok: false, error: "This transaction reference has already been used for another booking." };
  }

  try {
    const row = await prisma.customerBooking.update({
      where: { id: existing.id },
      data: {
        paymentStatus: "Submitted",
        utrNumber: trimmedUtr,
        paymentScreenshotUrl: screenshotUrl ?? undefined,
        paymentNote: null,
        paymentSubmittedAt: new Date(),
      },
    });
    invalidateCustomerBookingsCache(existing.userId);
    return { ok: true, booking: toBooking(row), partnerBookingId: existing.partnerBookingId };
  } catch (err) {
    // Belt-and-braces: the DB also enforces this via a partial unique index on
    // (utr_number) WHERE payment_status IN ('Submitted','Verified'), closing the race
    // window between the check above and this update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "This transaction reference has already been used for another booking." };
    }
    throw err;
  }
}

const COMMENT_MAX_LENGTH = 500;

/** 1-5 integer only — enforced again at the DB level via a CHECK constraint, this is
 *  just what gives the customer a clear error instead of a raw constraint-violation 500. */
export function isValidStars(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Trims, drops control characters, and caps length — comments are rendered back to
 *  users (React auto-escapes on render, but this keeps the stored value itself clean
 *  regardless of where it's ever displayed). */
function sanitizeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, COMMENT_MAX_LENGTH);
}

export interface SubmitRatingResult {
  ok: boolean;
  error?: string;
  booking?: Booking;
}

/** A comment is mandatory for anything below a perfect 5-star rating — the UI enforces
 *  this too (see RatingForm.tsx), but a request that skips the client must not be able
 *  to submit a low rating with no explanation. `comment` here is already the sanitized,
 *  post-trim value, so an empty string/null both correctly count as "no comment". */
function requiredCommentError(stars: number, comment: string | null): string | null {
  if (stars < 5 && !comment) {
    return "Please add a comment explaining your rating before submitting.";
  }
  return null;
}

/**
 * Resolves the ShopOwner behind a customer_booking's vehicle — every real booking goes
 * through POST /api/bookings, which requires getVehicleForBooking() to succeed (only
 * for "partner-"-prefixed vehicle ids), so this should always resolve for a genuine
 * booking. Returns null only in the rare case the vehicle/shop was deleted after the
 * booking was made, which the caller must treat as "can't rate the partner" rather
 * than silently guessing an owner.
 */
async function resolveOwnerIdForBooking(vehicleId: string): Promise<string | null> {
  if (!vehicleId.startsWith("partner-")) return null;
  const realId = vehicleId.slice("partner-".length);
  const vehicle = await prisma.vehicle.findUnique({ where: { id: realId }, select: { ownerId: true } });
  return vehicle?.ownerId ?? null;
}

/**
 * Records the customer's rating of the shop/partner for a Completed+Verified booking.
 * Transactionally increments ShopOwner.ratingSum/ratingCount alongside the insert
 * (unlike the best-effort status mirrors elsewhere in this file) — that aggregate is
 * what drives the static→dynamic shop-rating switch, so losing the increment on a rare
 * failure would silently corrupt every future display of this shop's rating, not just
 * one cosmetic status field.
 *
 * `existing` must come from getBookingRowForUser() for this same booking+user, exactly
 * like submitBookingPayment() above — reused instead of re-querying.
 */
export async function submitPartnerRating(
  existing: NonNullable<Awaited<ReturnType<typeof getBookingRowForUser>>>,
  starsInput: unknown,
  commentInput: unknown
): Promise<SubmitRatingResult> {
  if (!isRateable(existing)) {
    return { ok: false, error: "This booking isn't eligible for rating yet." };
  }
  if (!isValidStars(starsInput)) {
    return { ok: false, error: "Choose a star rating from 1 to 5." };
  }
  const comment = sanitizeComment(commentInput);
  const commentError = requiredCommentError(starsInput, comment);
  if (commentError) return { ok: false, error: commentError };

  const ownerId = await resolveOwnerIdForBooking(existing.vehicleId);
  if (!ownerId) {
    return { ok: false, error: "This listing is no longer available, so it can't be rated." };
  }

  try {
    await prisma.$transaction([
      prisma.partnerRating.create({
        data: { customerBookingId: existing.id, userId: existing.userId, ownerId, stars: starsInput, comment },
      }),
      prisma.shopOwner.update({
        where: { id: ownerId },
        data: { ratingSum: { increment: starsInput }, ratingCount: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You've already rated this partner for this booking." };
    }
    throw err;
  }

  // ShopOwner.ratingSum/ratingCount just changed, and every cached listing row for this
  // owner's vehicles carries a snapshot of it (see @rento/db's VEHICLE_WITH_SHOP_COLUMNS)
  // — without this, a shop crossing the 5-rating static->dynamic threshold wouldn't show
  // its real average until the listing cache's own TTL happened to expire.
  invalidateVehicleListingCaches(ownerId);
  // getBookingsForUser() attaches this rating to its matching booking row — without
  // this, this customer's own /api/bookings poll would keep showing "not yet rated" on
  // the booking they just rated for up to CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS.
  invalidateCustomerBookingsCache(existing.userId);

  const booking = await attachRatings(toBooking(existing), existing.id);
  return { ok: true, booking };
}

/**
 * Records the customer's rating of the Rento platform for a Completed+Verified
 * booking. No cached aggregate to update — the platform-wide average is computed live
 * over PlatformRating (see the GET /api/platform-rating route), since that table is far
 * smaller than bookings.
 */
export async function submitPlatformRating(
  existing: NonNullable<Awaited<ReturnType<typeof getBookingRowForUser>>>,
  starsInput: unknown,
  commentInput: unknown
): Promise<SubmitRatingResult> {
  if (!isRateable(existing)) {
    return { ok: false, error: "This booking isn't eligible for rating yet." };
  }
  if (!isValidStars(starsInput)) {
    return { ok: false, error: "Choose a star rating from 1 to 5." };
  }
  const comment = sanitizeComment(commentInput);
  const commentError = requiredCommentError(starsInput, comment);
  if (commentError) return { ok: false, error: commentError };

  try {
    await prisma.platformRating.create({
      data: { customerBookingId: existing.id, userId: existing.userId, stars: starsInput, comment },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You've already rated the Rento app for this booking." };
    }
    throw err;
  }

  invalidatePlatformRatingCache();
  invalidateCustomerBookingsCache(existing.userId);

  const booking = await attachRatings(toBooking(existing), existing.id);
  return { ok: true, booking };
}

export interface CancelBookingResult {
  ok: boolean;
  error?: string;
  booking?: Booking;
  /** The refund quote that was frozen onto the row — returned so the caller can show
   *  the customer exactly what was recorded, not a second, separately-computed figure. */
  quote?: RefundQuote;
}

/**
 * Customer-initiated cancellation of their own booking.
 *
 * Two things have to happen together, which is why this is a transaction rather than
 * the best-effort mirror pattern used for status *display* syncs elsewhere in this
 * file: the customer's row is marked Cancelled, and the mirrored partner booking is
 * too. The partner row is the one that actually holds the stock — bookedQuantity (see
 * @rento/db) counts `status = 'Upcoming'` rows — so if that write were lost, the unit
 * would stay blocked for a booking that no longer exists, with no time-based fallback
 * to release it the way an unpaid Pending hold has. A paid booking's unit is only ever
 * freed by this write landing.
 *
 * `existing` must come from getBookingRowForUser() for this same booking+user, the same
 * already-scoped fetch reused by submitBookingPayment() and the rating submitters.
 */
export async function cancelBookingForUser(
  existing: NonNullable<Awaited<ReturnType<typeof getBookingRowForUser>>>,
  now: Date = new Date()
): Promise<CancelBookingResult> {
  const blocked = customerCancelBlockReason(
    { status: existing.status as Booking["status"], pickupDateTime: existing.pickupDateTime },
    now
  );
  if (blocked) return { ok: false, error: blocked };

  const quote = quoteRefund(
    {
      pickupDateTime: existing.pickupDateTime.toISOString(),
      totalPayableOnline: existing.totalPayableOnline,
      status: existing.status as Booking["status"],
      paymentStatus: existing.paymentStatus as Booking["paymentStatus"],
    },
    { now, cancelledBy: "customer" }
  );

  // An unpaid hold being dropped is the same end state the lazy expiry produces, so it
  // reports the same way. A booking that *was* paid keeps its payment status — the
  // money genuinely changed hands; what's owed back lives in the refund columns.
  const paymentStatusUpdate = existing.paymentStatus === "Pending" ? { paymentStatus: "Expired" as const } : {};

  const [customerResult] = await prisma.$transaction([
    // Scoped to still-Upcoming rather than by id alone: if the shop marked this
    // Completed or Cancelled between our read and this write, we must not overwrite
    // their decision. Zero matched rows means exactly that, and is reported as a
    // conflict instead of a false success.
    prisma.customerBooking.updateMany({
      where: { id: existing.id, status: "Upcoming" },
      data: {
        status: "Cancelled",
        ...paymentStatusUpdate,
        cancelledAt: now,
        cancelledBy: "customer",
        refundPercent: quote.refundPercent,
        refundAmount: quote.refundAmount,
      },
    }),
    // Releases the stock. Same Upcoming scoping, and a no-op when this booking was
    // never mirrored (a legacy row, or a mirror that failed at creation time).
    ...(existing.partnerBookingId
      ? [
          prisma.booking.updateMany({
            where: { id: existing.partnerBookingId, status: "Upcoming" },
            data: { status: "Cancelled", ...paymentStatusUpdate },
          }),
        ]
      : []),
  ]);

  if (customerResult.count === 0) {
    return { ok: false, error: "This booking was just updated elsewhere. Refresh the page and try again." };
  }

  // A paid booking's cancellation is the only way its held unit gets released back to
  // the pool (see this function's own doc comment) — the public listing and per-vehicle
  // availability caches must reflect that immediately, not after their own TTLs elapse
  // and more customers are wrongly told the vehicle is unavailable. No owner id cheaply
  // on hand here (this row only carries the mirrored booking id, not the owner) so this
  // clears the global listing key and the vehicle's own availability entry only; that
  // owner's own dashboard cache still self-corrects within a few seconds via its normal
  // TTL. `vehicleId` is this app's own "partner-<uuid>" wire format, not the bare id the
  // cache key expects — strip the prefix (mirrors partnerDb.ts's own resolvePhotoUrl-style
  // vehicleId handling).
  if (existing.partnerBookingId) {
    const realVehicleId = existing.vehicleId.startsWith("partner-")
      ? existing.vehicleId.slice("partner-".length)
      : undefined;
    invalidateVehicleListingCaches(undefined, realVehicleId);
  }
  // Otherwise this customer's own /api/bookings poll would keep showing the
  // now-stale "Upcoming" status for up to CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS.
  invalidateCustomerBookingsCache(existing.userId);

  // Built from the row we already hold plus the values we just wrote, rather than
  // re-reading it back. The update matched (count > 0), so these *are* the persisted
  // values — and at this app's distance from Neon a round trip costs ~200ms measured,
  // which is far more than everything else this function does put together.
  const booking = toBooking({
    ...existing,
    status: "Cancelled",
    paymentStatus: paymentStatusUpdate.paymentStatus ?? existing.paymentStatus,
    cancelledAt: now,
    cancelledBy: "customer",
    refundPercent: quote.refundPercent,
    refundAmount: quote.refundAmount,
  });
  return { ok: true, booking, quote };
}

export async function createContactMessage(data: {
  name: string;
  contact: string;
  message: string;
}): Promise<void> {
  await prisma.contactMessage.create({ data });
}
