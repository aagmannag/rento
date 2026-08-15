/**
 * Cancellation & refund policy — the single source of truth.
 *
 * Refunds are tiered on how far ahead of the scheduled pickup the cancellation
 * happens, and apply only to the rental cost paid online. The security deposit is
 * never collected online, so it is never part of a refund.
 *
 *   6 hours or more before pickup → 100%
 *   3 to 6 hours before pickup    →  80%
 *   1 to 3 hours before pickup    →  50%
 *   under 1 hour, or after pickup →   0%
 *
 * Every surface that states or computes the policy — the policy page, the booking
 * summary, the confirmation page, support tooling — must read from here, so the
 * numbers can never drift apart between what a customer is promised and what they
 * are actually quoted.
 */

const MS_PER_HOUR = 3_600_000;

export interface CancellationTier {
  /** Lower bound, in hours before pickup, for this tier to apply. Inclusive: a
   *  cancellation exactly 6 hours out still earns the full 100%. */
  minHoursBefore: number;
  refundPercent: number;
  /** Short label for the policy page and refund quotes. */
  label: string;
  description: string;
}

/** Ordered from most to least generous. `refundPercentForHours` relies on that order. */
export const CANCELLATION_TIERS: readonly CancellationTier[] = [
  {
    minHoursBefore: 6,
    refundPercent: 100,
    label: "6 hours or more before pickup",
    description:
      "Cancel any time up to 6 hours before your scheduled pickup and the full rental cost paid online is refunded.",
  },
  {
    minHoursBefore: 3,
    refundPercent: 80,
    label: "3 to 6 hours before pickup",
    description:
      "80% of the rental cost paid online is refunded. The shop has already reserved the vehicle for your slot, so 20% is retained.",
  },
  {
    minHoursBefore: 1,
    refundPercent: 50,
    label: "1 to 3 hours before pickup",
    description:
      "50% of the rental cost paid online is refunded. At this point the vehicle is prepared and can rarely be re-let for the same slot.",
  },
  {
    minHoursBefore: 0,
    refundPercent: 0,
    label: "Less than 1 hour before pickup",
    description:
      "Cancellations in the final hour before pickup are non-refundable, as is a booking that is never collected — once the pickup time passes there is no refund to claim.",
  },
] as const;

export const FREE_CANCELLATION_HOURS = CANCELLATION_TIERS[0].minHoursBefore;

/** The tier that applies `hoursBefore` hours ahead of pickup. Negative values (pickup
 *  already passed) fall through to the final, 0% tier, as does NaN — an unreadable
 *  figure must never be quoted as a refund. */
export function tierForHours(hoursBefore: number): CancellationTier {
  const last = CANCELLATION_TIERS[CANCELLATION_TIERS.length - 1];
  if (Number.isNaN(hoursBefore)) return last;
  for (const tier of CANCELLATION_TIERS) {
    if (hoursBefore >= tier.minHoursBefore) return tier;
  }
  return last;
}

export function refundPercentForHours(hoursBefore: number): number {
  return tierForHours(hoursBefore).refundPercent;
}

/**
 * Why a booking is (or isn't) quoted a tiered refund.
 *
 * - `tiered`            — normal case; `refundPercent` comes from the tier table.
 * - `shop-cancelled`    — the shop couldn't honour the booking. Always refunded in
 *                         full regardless of timing; the customer is not at fault.
 * - `nothing-paid`      — no online payment has been captured, so there is nothing to
 *                         refund. Letting the hold lapse cancels the booking by itself.
 * - `already-cancelled` — the booking is already cancelled; any refund is settled.
 * - `not-cancellable`   — the rental is already completed.
 * - `unknown`           — the pickup time can't be read, so no figure can be quoted
 *                         without support looking at the booking.
 */
export type RefundOutcome =
  | "tiered"
  | "shop-cancelled"
  | "nothing-paid"
  | "already-cancelled"
  | "not-cancellable"
  | "unknown";

/** The minimum a booking must expose to be quoted. `Booking` satisfies it structurally. */
export interface QuotableBooking {
  pickupDateTime: string;
  totalPayableOnline: number;
  status: "Upcoming" | "Completed" | "Cancelled";
  paymentStatus: "Pending" | "Submitted" | "Verified" | "Rejected" | "Expired";
}

export interface RefundQuote {
  outcome: RefundOutcome;
  /** 0–100. Always 0 for outcomes that aren't `tiered` or `shop-cancelled`. */
  refundPercent: number;
  /** Rupees, rounded to the nearest whole rupee and never more than `baseAmount`. */
  refundAmount: number;
  /** The rental cost paid online that the percentage applies to. */
  baseAmount: number;
  /** Non-refundable remainder of `baseAmount`. */
  forfeitAmount: number;
  /** The tier in force right now — null when no tier applies (see `outcome`). */
  tier: CancellationTier | null;
  /** Hours until pickup; negative once pickup has passed, null if unreadable. */
  hoursUntilPickup: number | null;
  /** The tier that takes over when the current one lapses; null at the final tier. */
  nextTier: CancellationTier | null;
  /** When the current tier lapses — i.e. when `refundPercent` drops. Null at the
   *  final tier or when there is no tier in force. */
  tierEndsAt: Date | null;
  /** Deadline for a 100% refund. In the past once it has lapsed; null if unreadable. */
  freeCancellationUntil: Date | null;
  /** True while a cancellation right now would still return the full amount paid. */
  isFullyRefundable: boolean;
}

function emptyQuote(outcome: RefundOutcome, baseAmount: number, freeUntil: Date | null): RefundQuote {
  return {
    outcome,
    refundPercent: 0,
    refundAmount: 0,
    baseAmount,
    forfeitAmount: baseAmount,
    tier: null,
    hoursUntilPickup: null,
    nextTier: null,
    tierEndsAt: null,
    freeCancellationUntil: freeUntil,
    isFullyRefundable: false,
  };
}

/**
 * What a booking would be refunded if it were cancelled at `now`.
 *
 * Pure and timezone-safe: everything is epoch-millisecond arithmetic, so it gives the
 * same answer on the server and in any browser locale. Client-side callers are showing
 * an estimate against the visitor's clock — the server stays the authority when a
 * cancellation is actually processed.
 */
export function quoteRefund(
  booking: QuotableBooking,
  options: { now?: number | Date; cancelledBy?: "customer" | "shop" } = {},
): RefundQuote {
  const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
  const cancelledBy = options.cancelledBy ?? "customer";

  // A negative or non-finite amount can only come from corrupt data; treat it as zero
  // rather than quoting a nonsense refund.
  const rawBase = Number(booking.totalPayableOnline);
  const baseAmount = Number.isFinite(rawBase) && rawBase > 0 ? rawBase : 0;

  const pickupMs = new Date(booking.pickupDateTime).getTime();
  const pickupReadable = Number.isFinite(pickupMs);
  const freeCancellationUntil = pickupReadable
    ? new Date(pickupMs - FREE_CANCELLATION_HOURS * MS_PER_HOUR)
    : null;

  if (booking.status === "Cancelled") return emptyQuote("already-cancelled", baseAmount, freeCancellationUntil);
  if (booking.status === "Completed") return emptyQuote("not-cancellable", baseAmount, freeCancellationUntil);

  // "Submitted" counts as paid: the money has left the customer and is awaiting
  // verification. Pending/Rejected/Expired mean nothing was ever captured online.
  const paidOnline =
    (booking.paymentStatus === "Verified" || booking.paymentStatus === "Submitted") && baseAmount > 0;

  if (cancelledBy === "shop") {
    // The customer didn't choose this, so the tiers don't apply — they are made whole.
    return {
      ...emptyQuote("shop-cancelled", baseAmount, freeCancellationUntil),
      refundPercent: paidOnline ? 100 : 0,
      refundAmount: paidOnline ? baseAmount : 0,
      forfeitAmount: 0,
      hoursUntilPickup: pickupReadable ? (pickupMs - now) / MS_PER_HOUR : null,
      isFullyRefundable: paidOnline,
    };
  }

  if (!paidOnline) return emptyQuote("nothing-paid", baseAmount, freeCancellationUntil);
  if (!pickupReadable) return emptyQuote("unknown", baseAmount, null);

  const hoursUntilPickup = (pickupMs - now) / MS_PER_HOUR;
  const tier = tierForHours(hoursUntilPickup);
  const tierIndex = CANCELLATION_TIERS.indexOf(tier);
  const nextTier = tierIndex >= 0 && tierIndex < CANCELLATION_TIERS.length - 1
    ? CANCELLATION_TIERS[tierIndex + 1]
    : null;

  // Round to whole rupees and clamp — floating-point percentages must never produce a
  // refund above what was actually paid.
  const refundAmount = Math.min(baseAmount, Math.max(0, Math.round((baseAmount * tier.refundPercent) / 100)));

  return {
    outcome: "tiered",
    refundPercent: tier.refundPercent,
    refundAmount,
    baseAmount,
    forfeitAmount: Math.max(0, baseAmount - refundAmount),
    tier,
    hoursUntilPickup,
    nextTier,
    tierEndsAt: nextTier ? new Date(pickupMs - tier.minHoursBefore * MS_PER_HOUR) : null,
    freeCancellationUntil,
    isFullyRefundable: refundAmount >= baseAmount && baseAmount > 0,
  };
}

/**
 * Why this booking can't be cancelled by the customer themselves, or null when it can.
 *
 * One rule, read by both sides: the server enforces it in cancelBookingForUser(), and
 * the UI uses it to decide whether to offer a Cancel control at all — so a customer is
 * never shown a button that can only fail, and a client that skips the UI still can't
 * get past the server. The returned string is customer-facing copy.
 */
export function customerCancelBlockReason(
  booking: { status: QuotableBooking["status"]; pickupDateTime: string | Date },
  now: number | Date = Date.now(),
): string | null {
  if (booking.status === "Cancelled") return "This booking is already cancelled.";
  if (booking.status === "Completed") return "This rental is already completed, so it can't be cancelled.";

  const pickupMs =
    booking.pickupDateTime instanceof Date
      ? booking.pickupDateTime.getTime()
      : new Date(booking.pickupDateTime).getTime();
  if (!Number.isFinite(pickupMs)) {
    return "We couldn't read this booking's pickup time. Please contact support to cancel it.";
  }

  // Hard stop at pickup time. Past it we can't tell a customer who never turned up from
  // one who already has the vehicle in hand, and self-cancelling the latter would
  // release a unit that is physically gone. It costs the customer nothing either way:
  // the refund is 0% from an hour before pickup onwards.
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (nowMs >= pickupMs) {
    return "Your pickup time has already passed, so this booking can't be cancelled online. Please contact support.";
  }

  return null;
}

/** Milliseconds until the quoted percentage drops, or null when it can't drop further.
 *  Lets a live display schedule its next refresh exactly on the boundary. */
export function msUntilRefundDrops(quote: RefundQuote, now: number = Date.now()): number | null {
  if (!quote.tierEndsAt) return null;
  return Math.max(0, quote.tierEndsAt.getTime() - now);
}
