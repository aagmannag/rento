import { Prisma } from "@prisma/client";
import type { Booking, PrismaClient } from "@prisma/client";
import { prisma } from "./client";
import { invalidateVehicleListingCaches } from "./vehicles";
import { invalidateCache } from "./cache";
import { isPendingHoldExpired, PENDING_HOLD_MINUTES } from "./constants";

export { isPendingHoldExpired, MIN_ONLINE_PAYMENT_RUPEES, PENDING_HOLD_MINUTES } from "./constants";

type Queryable = Pick<PrismaClient, "$queryRaw"> | Prisma.TransactionClient;

// portalPartner's own owner-booking-dashboard cache (getBookingsForOwner) — the key
// builder lives here, not there, for the same reason ADMIN_ALL_VEHICLES_CACHE_KEY does
// (see vehicles.ts's own comment on it): a new booking is created from THIS shared
// write path (createBookingForVehicle below), reached from rentoCustomer, so
// invalidation has to happen from here to reach across the app boundary. portalPartner's
// own writes to a booking (status change, rating) import and reuse this exact key
// builder too, rather than duplicating the string, so the two can never drift apart.
export const ownerBookingsCacheKey = (ownerId: string) => `cache:v1:partner:bookings:${ownerId}`;
export function invalidateOwnerBookingsCache(ownerId: string): void {
  void invalidateCache([ownerBookingsCacheKey(ownerId)]);
}

// rentoCustomer's own /api/bookings (getBookingsForUser) — same cross-app-key-builder
// reasoning as ownerBookingsCacheKey above: portalPartner's updateBookingStatus mirrors
// a status change into rentoCustomer's customer_bookings table (a second, cross-app
// writer to this data), and needs to invalidate the exact same cache entry
// rentoCustomer reads. Measured via RequestTimer: this endpoint fires on nearly every
// customer-facing navigation and was paying a full ~200-600ms warm / 1-3s cold Neon
// round trip (3 parallel queries) on every single call, unlike portalPartner's
// equivalent owner-bookings read which already had this caching.
export const customerBookingsCacheKey = (userId: string) => `cache:v1:customer:bookings:${userId}`;
// Must comfortably exceed rentoCustomer's own bookings poll interval (10s — see
// providers.tsx's usePolling(loadBookings, 10_000, ...)) — a TTL shorter than the poll
// interval it's meant to absorb guarantees every scheduled tick misses the cache.
export const CUSTOMER_BOOKINGS_CACHE_TTL_SECONDS = 15;
export function invalidateCustomerBookingsCache(userId: string): void {
  void invalidateCache([customerBookingsCacheKey(userId)]);
}

/**
 * Every Upcoming booking for a vehicle — placed by ANY customer, in ANY browser or
 * session — ties up `quantity` units. Aggregating this in SQL (rather than filtering
 * whatever bookings happen to be loaded client-side) is what makes availability
 * consistent no matter who's looking or from where.
 *
 * Payment status refines this further, since bookings go through manual UPI
 * verification rather than confirming instantly:
 *   - Rejected/Expired payments never hold a unit (released immediately/on expiry).
 *   - Submitted/Verified always hold a unit (real payment claimed or confirmed).
 *   - Pending (no UTR submitted yet) only holds a unit for PENDING_HOLD_MINUTES — an
 *     abandoned checkout shouldn't tie up stock forever with nothing to show for it.
 *     This is a pure time check, not a stored status, so the release is instant and
 *     exact — it doesn't wait on a cron job or on someone else's request happening to
 *     touch the row and flip it to Expired first (that flip, done lazily elsewhere,
 *     only affects what status the row itself later reports).
 *
 * Shared by portalPartner (owner's own stock view) and rentoCustomer (customer-facing
 * availability) so the "what counts as booked" rule can never drift between the two.
 */
export async function bookedQuantity(client: Queryable, vehicleId: string): Promise<number> {
  const rows = await client.$queryRaw<{ booked: bigint }[]>`
    SELECT COALESCE(SUM(quantity), 0) AS booked
    FROM bookings
    WHERE vehicle_id = ${vehicleId}::uuid AND status = 'Upcoming'
      AND (
        payment_status IN ('Submitted', 'Verified')
        OR (payment_status = 'Pending' AND created_at > now() - interval '1 minute' * ${PENDING_HOLD_MINUTES})
      )
  `;
  return Number(rows[0]?.booked ?? 0);
}

export interface CreateBookingForVehicleInput {
  vehicleId: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  /** The rentoCustomer User.id making this booking, when known (session-authenticated
   *  bookings always know it). Threaded onto Booking.userId so the ratings feature can
   *  reliably resolve which customer to credit a CustomerRating to without depending on
   *  customerPhone matching whatever the user's phone happens to be later. */
  userId?: string;
  pickupDateTime: Date;
  returnDateTime: Date;
  quantity: number;
  totalAmount: number;
}

export type CreateBookingForVehicleResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" | "sold_out" };

/**
 * Atomically re-checks availability and inserts the booking, closing the race window
 * that existed when these were two separate, unlocked queries: two simultaneous
 * requests for a vehicle's last unit could otherwise both pass the check before either
 * insert landed, overselling it. `FOR UPDATE OF v` locks the vehicle row for the
 * duration of this transaction, serializing concurrent bookings against the same
 * vehicle, and the availability check re-runs *inside* that lock, right before the
 * insert.
 *
 * The lock-acquisition query and the booked-quantity aggregate (identical WHERE clause
 * to `bookedQuantity` above) are combined into one round trip via the same LEFT JOIN
 * LATERAL pattern used elsewhere in this package — verified via EXPLAIN ANALYZE against
 * production data to produce an identical query plan/result to running them as two
 * separate queries, just without the extra round trip. This matters more here than
 * anywhere else it's used: every millisecond saved is a millisecond less this row stays
 * locked, which is what determines how long *other* concurrent booking attempts for the
 * same vehicle have to queue behind this one.
 */
export async function createBookingForVehicle(
  input: CreateBookingForVehicleInput
): Promise<CreateBookingForVehicleResult> {
  const result = await prisma.$transaction(async (tx): Promise<CreateBookingForVehicleResult> => {
    const rows = await tx.$queryRaw<{ id: string; stock: number; booked: bigint }[]>`
      SELECT v.id, v.stock, COALESCE(bq.booked, 0) AS booked
      FROM vehicles v
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(b.quantity), 0) AS booked
        FROM bookings b
        WHERE b.vehicle_id = v.id AND b.status = 'Upcoming'
          AND (
            b.payment_status IN ('Submitted', 'Verified')
            OR (b.payment_status = 'Pending' AND b.created_at > now() - interval '1 minute' * ${PENDING_HOLD_MINUTES})
          )
      ) bq ON true
      WHERE v.id = ${input.vehicleId}::uuid
      FOR UPDATE OF v
    `;
    const vehicle = rows[0];
    if (!vehicle) return { ok: false, reason: "not_found" };

    const booked = Number(vehicle.booked);
    if (vehicle.stock - booked < input.quantity) {
      return { ok: false, reason: "sold_out" };
    }

    const booking = await tx.booking.create({
      data: {
        ownerId: input.ownerId,
        vehicleId: input.vehicleId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        userId: input.userId,
        pickupDateTime: input.pickupDateTime,
        returnDateTime: input.returnDateTime,
        quantity: input.quantity,
        totalAmount: input.totalAmount,
      },
    });
    return { ok: true, booking };
  });

  // Outside the transaction (no reason to hold the row lock any longer than the insert
  // itself needs) — this is best-effort cache freshness, not correctness (the atomic
  // availability check above is what actually prevents overbooking), so it isn't awaited.
  if (result.ok) {
    invalidateVehicleListingCaches(input.ownerId, input.vehicleId);
    // The new booking just landed in this owner's own bookings table — their dashboard
    // must show it without waiting out OWNER_BOOKINGS_CACHE_TTL_SECONDS.
    invalidateOwnerBookingsCache(input.ownerId);
  }

  return result;
}
