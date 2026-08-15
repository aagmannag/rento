/**
 * How long a Pending (no UTR submitted yet) booking holds its unit before an abandoned
 * checkout releases it back to everyone else. Single source of truth for this number —
 * used by every query anywhere in this package that decides whether a Pending booking
 * still counts as holding stock (bookedQuantity/createBookingForVehicle in booking.ts,
 * the BOOKED_LATERAL join in vehicles.ts) and by rentoCustomer's lazy expiry sweep,
 * which must all agree exactly with what these queries already treat as "no longer
 * holding a unit" — otherwise a vehicle could show as unavailable in a listing well
 * after its hold actually expired (or vice versa), and a booking could show as live in
 * the customer's own UI after its stock was already released to someone else.
 *
 * Lives in its own module (rather than alongside bookedQuantity() in booking.ts, where
 * it originally did) specifically so vehicles.ts can import it too without a circular
 * dependency between the two — vehicles.ts's invalidateVehicleListingCaches() is called
 * from booking.ts, so booking.ts -> vehicles.ts already exists as an edge.
 */
export const PENDING_HOLD_MINUTES = 5;

/** True once a Pending booking's hold window has elapsed and its unit is free again. */
export function isPendingHoldExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() >= PENDING_HOLD_MINUTES * 60_000;
}

/**
 * Floor on both a vehicle's price-per-day/price-per-hour (portalPartner's listing
 * validation) and a booking's actual payable-online total (rentoCustomer's booking-
 * creation guard, which also protects against any pre-existing listing priced below
 * this floor before it existed).
 *
 * This isn't a Rento-imposed business rule so much as a defensive floor against a real
 * UPI failure mode: banks commonly flag trivially small "penny" UPI payments (₹1, up to
 * a few rupees) as a pattern fraudsters use to verify a UPI ID is alive before a larger
 * scam, and silently reject them with a generic "exceeded bank limit" error instead of a
 * clear "amount too small" one — which looks like a broken payment flow to a genuine
 * customer, not a rejected fraud probe. ₹10 sits comfortably above the amounts that
 * pattern typically uses.
 */
export const MIN_ONLINE_PAYMENT_RUPEES = 10;
