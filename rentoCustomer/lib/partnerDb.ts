import { Pool } from "pg";
import type { Booking, Category, City, Vehicle } from "./types";
import { CATEGORY_EMOJI } from "./data";

// Reads the shop_owners/vehicles tables owned by the portalForShopOwner app. That app
// creates this schema itself (see its lib/db.ts) — this file only ever SELECTs, so it's
// safe even if the portal app has never run against this database yet (queries just
// return zero rows via a caught error instead of crashing the customer app).
let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    // Neon (and most managed Postgres providers) require SSL; local Docker/Postgres
    // doesn't speak it at all. Detect by host rather than NODE_ENV so this works
    // correctly regardless of how/where the app is actually running.
    const isLocalHost = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
    });
    // A pooled client that's just sitting idle can still emit an 'error' if its
    // connection to Postgres drops (e.g. the DB restarts or a network blip). Without
    // this listener, Node treats that as an uncaught exception and kills the whole
    // process — for every user, not just whoever's request was in flight.
    pool.on("error", (err) => console.error("Unexpected error on idle Postgres client:", err));
  }
  return pool;
}

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

interface PartnerVehicleRow {
  id: string;
  category: string;
  name: string;
  brand: string;
  engine_label: string;
  photo_url: string | null;
  photo_urls: string[] | null;
  price_per_day: number;
  price_per_hour: number;
  security_deposit: number;
  stock: number;
  booked: string;
  fuel: string;
  transmission: string;
  seats: number;
  mileage: string;
  features: string[];
  city: string;
  shop_name: string;
  shop_address: string;
  shop_latitude: number | null;
  shop_longitude: number | null;
}

// Every Upcoming booking for a vehicle — placed by ANY customer, in ANY browser or
// session — ties up `quantity` units. Aggregating this in SQL (rather than filtering
// whatever bookings happen to be loaded client-side) is what makes availability
// consistent no matter who's looking or from where.
//
// Payment status refines this further, since bookings now go through manual UPI
// verification rather than confirming instantly:
//   - Rejected payments never hold a unit (released immediately).
//   - Submitted/Verified always hold a unit (real payment claimed or confirmed).
//   - Pending (no UTR submitted yet) only holds a unit for 30 minutes — an abandoned
//     checkout shouldn't tie up stock forever with nothing to show for it.
const BOOKED_QUANTITY_SUBQUERY = `
  COALESCE((
    SELECT SUM(b.quantity) FROM bookings b
    WHERE b.vehicle_id = v.id AND b.status = 'Upcoming'
      AND (
        b.payment_status IN ('Submitted', 'Verified')
        OR (b.payment_status = 'Pending' AND b.created_at > now() - interval '30 minutes')
      )
  ), 0)
`;

/** Vehicles listed by shop owners through the Partner portal, mapped into this app's Vehicle shape. */
export async function getPartnerVehicles(): Promise<Vehicle[]> {
  const db = getPool();
  if (!db) return [];

  try {
    const result = await db.query<PartnerVehicleRow>(`
      SELECT v.id, v.category, v.name, v.brand, v.engine_label, v.photo_url, v.photo_urls,
             v.price_per_day, v.price_per_hour, v.security_deposit, v.stock,
             ${BOOKED_QUANTITY_SUBQUERY}::text AS booked,
             v.fuel, v.transmission, v.seats, v.mileage, v.features, v.city,
             o.shop_name, o.address AS shop_address, o.latitude AS shop_latitude, o.longitude AS shop_longitude
      FROM vehicles v
      JOIN shop_owners o ON o.id = v.owner_id
      WHERE v.status = 'Active' AND o.status = 'Approved'
      ORDER BY v.created_at DESC
    `);

    return result.rows.map((row) => {
      const category = row.category as Category;
      return {
        id: `partner-${row.id}`,
        city: row.city as City,
        category,
        name: `${row.brand} ${row.name}`,
        brand: row.brand,
        engineLabel: row.engine_label || row.transmission,
        image: CATEGORY_EMOJI[category] ?? "🚘",
        photo: resolvePhotoUrl(row.photo_url),
        photos: resolvePhotoUrls(row.photo_urls, row.photo_url),
        pricePerDay: row.price_per_day,
        pricePerHour: row.price_per_hour,
        securityDeposit: row.security_deposit,
        stock: row.stock,
        availableStock: Math.max(0, row.stock - Number(row.booked)),
        rating: 4.5,
        ratingCount: 0,
        specs: {
          fuel: row.fuel,
          transmission: row.transmission,
          seats: row.seats,
          mileage: row.mileage,
        },
        features: row.features ?? [],
        shop: {
          name: row.shop_name,
          address: row.shop_address,
          latitude: row.shop_latitude,
          longitude: row.shop_longitude,
        },
      };
    });
  } catch (err) {
    // The portal's tables may not exist yet (fresh DB, or portal never run) — degrade
    // to "no partner vehicles" rather than breaking the customer app.
    console.error("Failed to load partner vehicles:", err);
    return [];
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

  const db = getPool();
  if (!db) return null;

  try {
    const result = await db.query<{ stock: number; booked: string }>(
      `SELECT v.stock, ${BOOKED_QUANTITY_SUBQUERY}::text AS booked
       FROM vehicles v
       JOIN shop_owners o ON o.id = v.owner_id
       WHERE v.id = $1 AND v.status = 'Active' AND o.status = 'Approved'`,
      [realId]
    );
    const row = result.rows[0];
    if (!row) return null;

    return { stock: row.stock, availableStock: Math.max(0, row.stock - Number(row.booked)) };
  } catch (err) {
    console.error("Failed to check vehicle availability:", err);
    return null;
  }
}

export interface TrustedVehicleInfo {
  name: string;
  image: string;
  photo?: string;
  city: string;
  category: string;
  shopName: string;
  shopAddress: string;
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

  const db = getPool();
  if (!db) return null;

  try {
    const result = await db.query<{
      brand: string;
      name: string;
      category: string;
      city: string;
      photo_url: string | null;
      price_per_day: number;
      price_per_hour: number;
      security_deposit: number;
      shop_name: string;
      shop_address: string;
      shop_latitude: number | null;
      shop_longitude: number | null;
    }>(
      `SELECT v.brand, v.name, v.category, v.city, v.photo_url,
              v.price_per_day, v.price_per_hour, v.security_deposit,
              o.shop_name, o.address AS shop_address, o.latitude AS shop_latitude, o.longitude AS shop_longitude
       FROM vehicles v
       JOIN shop_owners o ON o.id = v.owner_id
       WHERE v.id = $1 AND v.status = 'Active' AND o.status = 'Approved'`,
      [realId]
    );
    const row = result.rows[0];
    if (!row) return null;

    const category = row.category as Category;
    return {
      name: `${row.brand} ${row.name}`,
      image: CATEGORY_EMOJI[category] ?? "🚘",
      photo: resolvePhotoUrl(row.photo_url),
      city: row.city,
      category: row.category,
      shopName: row.shop_name,
      shopAddress: row.shop_address,
      shopLatitude: row.shop_latitude,
      shopLongitude: row.shop_longitude,
      pricePerDay: row.price_per_day,
      pricePerHour: row.price_per_hour,
      securityDeposit: row.security_deposit,
    };
  } catch (err) {
    console.error("Failed to load vehicle for booking:", err);
    return null;
  }
}

/**
 * When a customer books a vehicle listed through the Partner portal, mirror that
 * booking into the portal's own `bookings` table so the shop owner sees it in their
 * dashboard. Best-effort: the customer's own booking record (in customer_bookings)
 * is the source of truth for this app, so a failure here is logged, not thrown.
 * Returns the new mirrored row's id (stored as customer_bookings.partner_booking_id)
 * so its payment_status can be kept in sync later, or null if mirroring didn't happen.
 */
export async function createPartnerBooking(params: {
  vehicleId: string;
  customerName: string;
  customerPhone: string;
  pickupDateTime: string;
  returnDateTime: string;
  quantity: number;
  totalAmount: number;
}): Promise<string | null> {
  if (!params.vehicleId.startsWith("partner-")) return null;
  const realVehicleId = params.vehicleId.slice("partner-".length);

  const db = getPool();
  if (!db) return null;

  try {
    // Same approval gate as getPartnerVehicles() — a vehicle from a non-approved shop
    // shouldn't be bookable even via a crafted API call, since it was never shown to
    // any customer in the first place.
    const vehicleRow = await db.query<{ owner_id: string }>(
      `SELECT v.owner_id FROM vehicles v
       JOIN shop_owners o ON o.id = v.owner_id
       WHERE v.id = $1 AND o.status = 'Approved'`,
      [realVehicleId]
    );
    const ownerId = vehicleRow.rows[0]?.owner_id;
    if (!ownerId) return null;

    const result = await db.query<{ id: string }>(
      `INSERT INTO bookings
         (owner_id, vehicle_id, customer_name, customer_phone, pickup_datetime,
          return_datetime, quantity, total_amount, status, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Upcoming','Pending')
       RETURNING id`,
      [
        ownerId,
        realVehicleId,
        params.customerName,
        params.customerPhone,
        params.pickupDateTime,
        params.returnDateTime,
        params.quantity,
        params.totalAmount,
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    console.error("Failed to mirror booking into partner portal:", err);
    return null;
  }
}

/** Keeps the mirrored portal booking's payment status in step with the customer's own
 *  booking record whenever the customer submits/resubmits a UTR. Best-effort. */
export async function syncPartnerBookingPayment(
  partnerBookingId: string,
  paymentStatus: string,
  utrNumber: string | null
): Promise<void> {
  const db = getPool();
  if (!db) return;
  try {
    await db.query("UPDATE bookings SET payment_status = $2, utr_number = $3 WHERE id = $1", [
      partnerBookingId,
      paymentStatus,
      utrNumber,
    ]);
  } catch (err) {
    console.error("Failed to sync payment status into partner portal:", err);
  }
}
