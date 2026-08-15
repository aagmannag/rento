import {
  computeDisplayRating,
  createBookingForVehicle,
  getVehicleAvailabilityRow,
  listActivePartnerVehiclesWithAvailability,
  prisma,
  SHOP_RATING_STATIC_DEFAULT,
  SHOP_RATING_THRESHOLD,
  type VehicleWithAvailabilityRow,
} from "@rento/db";
import type { Booking, Category, City, Vehicle } from "./types";
import { CATEGORY_EMOJI } from "./data";

// Reads the shop_owners/vehicles tables owned by the portalPartner app, and mirrors
// bookings into its `bookings` table — this file only ever touches that app's
// "territory" in the shared database, never rentoCustomer's own tables.

// Partner vehicle photos are stored as paths relative to the portal app's own server
// (e.g. "/uploads/vehicles/xyz.webp"). This app runs on a different port, so those need
// to be resolved to the portal's origin before the browser can load them. Absolute
// http(s) URLs (owner-pasted web images) are left untouched.
const PARTNER_PORTAL_ORIGIN = process.env.PARTNER_PORTAL_ORIGIN || "http://localhost:3001";

function resolvePhotoUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${PARTNER_PORTAL_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function resolvePhotoUrls(urls: string[] | null, legacyPhotoUrl: string | null): string[] {
  // photo_urls is always kept in sync with photo_url by the partner portal, but this
  // stays defensive in case a row predates the migration and somehow missed the backfill.
  const source = urls?.length ? urls : legacyPhotoUrl ? [legacyPhotoUrl] : [];
  return source.map(resolvePhotoUrl).filter((u): u is string => Boolean(u));
}

function toVehicle(row: VehicleWithAvailabilityRow): Vehicle {
  const category = row.category as Category;
  // Every vehicle from the same shop shows the same rating — it's the shop's aggregate
  // (PartnerRating), not a per-vehicle-model rating, since "5 ratings unlocks dynamic"
  // is about the partner's overall service, not any one listing.
  const shopRating = computeDisplayRating(
    row.shopRatingSum,
    row.shopRatingCount,
    SHOP_RATING_THRESHOLD,
    SHOP_RATING_STATIC_DEFAULT
  );
  return {
    id: `partner-${row.id}`,
    city: row.city as City,
    category,
    name: `${row.brand} ${row.name}`,
    brand: row.brand,
    engineLabel: row.engineLabel || row.transmission,
    image: CATEGORY_EMOJI[category] ?? "🚘",
    photo: resolvePhotoUrl(row.photoUrl),
    photos: resolvePhotoUrls(row.photoUrls, row.photoUrl),
    pricePerDay: row.pricePerDay,
    pricePerHour: row.pricePerHour,
    securityDeposit: row.securityDeposit,
    stock: row.stock,
    availableStock: Math.max(0, row.stock - Number(row.booked)),
    rating: shopRating.value,
    ratingCount: shopRating.count,
    specs: {
      fuel: row.fuel,
      transmission: row.transmission,
      seats: row.seats,
      mileage: row.mileage,
    },
    features: row.features ?? [],
    shop: {
      name: row.shopName,
      address: row.shopAddress,
      latitude: row.shopLatitude,
      longitude: row.shopLongitude,
    },
  };
}

// listActivePartnerVehiclesWithAvailability() already caches this read itself (both an
// in-process tier and a shared Redis tier — see @rento/db's cache.ts), so this only needs
// to remember the last known-good result to serve if a request genuinely fails (Neon or
// Redis both unreachable), not to cache normal reads on top of that.
let lastKnownGoodVehicles: Vehicle[] = [];

/** Vehicles listed by shop owners through the Partner portal, mapped into this app's Vehicle shape. */
export async function getPartnerVehicles(): Promise<Vehicle[]> {
  try {
    const rows = await listActivePartnerVehiclesWithAvailability();
    const vehicles = rows.map(toVehicle);
    lastKnownGoodVehicles = vehicles;
    return vehicles;
  } catch (err) {
    console.error("Failed to load partner vehicles:", err);
    return lastKnownGoodVehicles;
  }
}

/**
 * Live, server-authoritative availability for a single vehicle — used right before
 * confirming a booking so the check reflects bookings made moments ago by anyone else,
 * not whatever the page happened to load with.
 */
export async function getVehicleAvailability(
  fullVehicleId: string
): Promise<{ stock: number; availableStock: number } | null> {
  if (!fullVehicleId.startsWith("partner-")) return null;
  const realId = fullVehicleId.slice("partner-".length);

  try {
    const vehicle = await getVehicleAvailabilityRow(realId);
    if (!vehicle) return null;

    const booked = Number(vehicle.booked);
    return { stock: vehicle.stock, availableStock: Math.max(0, vehicle.stock - booked) };
  } catch (err) {
    console.error("Failed to check vehicle availability:", err);
    return null;
  }
}

export interface TrustedVehicleInfo {
  ownerId: string;
  name: string;
  image: string;
  photo?: string;
  city: string;
  category: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string | null;
  shopLatitude: number | null;
  shopLongitude: number | null;
  pricePerDay: number;
  pricePerHour: number;
  securityDeposit: number;
}

/**
 * The server-trusted source of truth for a vehicle's current price/shop/display info,
 * used when creating a booking — every field a customer could otherwise tamper with
 * client-side (price, shop name, city, photo) gets overwritten with what's actually in
 * the database, gated by the same Active+Approved check as everywhere else a vehicle is
 * shown, so a crafted request can't book a de-listed or unapproved vehicle either.
 */
export async function getVehicleForBooking(fullVehicleId: string): Promise<TrustedVehicleInfo | null> {
  if (!fullVehicleId.startsWith("partner-")) return null;
  const realId = fullVehicleId.slice("partner-".length);

  try {
    const row = await prisma.vehicle.findFirst({
      where: { id: realId, status: "Active", owner: { status: "Approved" } },
      select: {
        ownerId: true,
        brand: true,
        name: true,
        category: true,
        city: true,
        photoUrl: true,
        pricePerDay: true,
        pricePerHour: true,
        securityDeposit: true,
        owner: { select: { shopName: true, address: true, phone: true, latitude: true, longitude: true } },
      },
    });
    if (!row) return null;

    const category = row.category as Category;
    return {
      ownerId: row.ownerId,
      name: `${row.brand} ${row.name}`,
      image: CATEGORY_EMOJI[category] ?? "🚘",
      photo: resolvePhotoUrl(row.photoUrl),
      city: row.city,
      category: row.category,
      shopName: row.owner.shopName,
      shopAddress: row.owner.address,
      shopPhone: row.owner.phone,
      shopLatitude: row.owner.latitude,
      shopLongitude: row.owner.longitude,
      pricePerDay: row.pricePerDay,
      pricePerHour: row.pricePerHour,
      securityDeposit: row.securityDeposit,
    };
  } catch (err) {
    console.error("Failed to load vehicle for booking:", err);
    return null;
  }
}

export type CreatePartnerBookingResult =
  // Mirrored successfully — customer_bookings.partner_booking_id should be set to id.
  | { status: "ok"; partnerBookingId: string }
  // Not a partner-listed vehicle, or its shop isn't Approved — nothing to mirror, but
  // this isn't the caller's problem: proceed with the customer's own booking as usual.
  | { status: "not_applicable" }
  // Authoritative, race-proof stock check failed at insert time (see @rento/db's
  // createBookingForVehicle) — the caller MUST NOT create the customer's own booking
  // either, or a customer could end up with a real booking for a unit that was never
  // actually reserved on the shop owner's side.
  | { status: "sold_out" }
  // Query/connection error — best-effort, matches every other cross-app write in this
  // file: log it, let the customer's own booking (source of truth) still go through.
  | { status: "mirror_failed" };

/**
 * When a customer books a vehicle listed through the Partner portal, mirror that
 * booking into the portal's own `bookings` table so the shop owner sees it in their
 * dashboard — and, since this is also where the vehicle's stock actually lives, this is
 * the authoritative, atomic point where availability is re-checked and reserved (see
 * @rento/db's createBookingForVehicle). The caller must check `status` and stop before
 * creating the customer's own booking record on "sold_out" — every other status is
 * safe to proceed past.
 *
 * `ownerId` must come from a call to getVehicleForBooking() for this same vehicle,
 * made moments earlier in the same request — that query is gated on the exact same
 * `owner.status === 'Approved'` condition this function used to re-check with its own
 * extra round trip. Reusing that result instead removes the duplicate query without
 * weakening the check: a vehicle from a non-approved shop still can never reach this
 * function, because getVehicleForBooking() would have already returned null for it
 * (and the caller must treat that as "vehicle not found" before ever calling here) —
 * see rentoCustomer/app/api/bookings/route.ts.
 */
export async function createPartnerBooking(params: {
  vehicleId: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  userId: string;
  pickupDateTime: string;
  returnDateTime: string;
  quantity: number;
  totalAmount: number;
}): Promise<CreatePartnerBookingResult> {
  if (!params.vehicleId.startsWith("partner-")) return { status: "not_applicable" };
  const realVehicleId = params.vehicleId.slice("partner-".length);

  try {
    const result = await createBookingForVehicle({
      vehicleId: realVehicleId,
      ownerId: params.ownerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      userId: params.userId,
      pickupDateTime: new Date(params.pickupDateTime),
      returnDateTime: new Date(params.returnDateTime),
      quantity: params.quantity,
      totalAmount: params.totalAmount,
    });
    if (!result.ok) {
      return result.reason === "sold_out" ? { status: "sold_out" } : { status: "not_applicable" };
    }
    return { status: "ok", partnerBookingId: result.booking.id };
  } catch (err) {
    console.error("Failed to mirror booking into partner portal:", err);
    return { status: "mirror_failed" };
  }
}

/** Keeps the mirrored portal booking's payment status in step with the customer's own
 *  booking record whenever the customer submits/resubmits a UTR. Best-effort. */
export async function syncPartnerBookingPayment(
  partnerBookingId: string,
  paymentStatus: "Pending" | "Submitted" | "Verified" | "Rejected",
  utrNumber: string | null
): Promise<void> {
  try {
    await prisma.booking.update({
      where: { id: partnerBookingId },
      data: { paymentStatus, utrNumber },
    });
  } catch (err) {
    console.error("Failed to sync payment status into partner portal:", err);
  }
}

/**
 * Mirrors a customer-side payment-hold expiry into the shop owner's own ledger, so
 * their dashboard doesn't keep showing an abandoned checkout as "Pending" forever.
 * Best-effort and idempotent (scoped to still-`Upcoming` rows) — this is purely a
 * display sync; the vehicle's actual stock was already released the moment the hold's
 * time window elapsed (see @rento/db's bookedQuantity), regardless of whether this
 * write ever lands.
 */
export async function syncPartnerBookingExpiry(partnerBookingId: string): Promise<void> {
  try {
    await prisma.booking.updateMany({
      where: { id: partnerBookingId, status: "Upcoming" },
      data: { status: "Cancelled", paymentStatus: "Expired" },
    });
  } catch (err) {
    console.error("Failed to sync payment-hold expiry into partner portal:", err);
  }
}
