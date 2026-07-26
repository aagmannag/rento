import { Pool } from "pg";
import type { Booking } from "./types";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Set it in .env.local (see .env.local.example).");
  }
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

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getPool();
      // gen_random_uuid() is built into Postgres 13+; pgcrypto covers older versions.
      // Some managed hosts don't allow CREATE EXTENSION for the app role, so this is
      // best-effort — schema creation still proceeds either way.
      try {
        await db.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      } catch {
        // ignore — gen_random_uuid() likely already available natively
      }
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL DEFAULT 'Rento User',
          gender TEXT,
          city TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      // Named distinctly (not "bookings") so this schema can safely share a database
      // with portalForShopOwner, which owns its own "bookings" table.
      await db.query(`
        CREATE TABLE IF NOT EXISTS customer_bookings (
          id TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          vehicle_id TEXT NOT NULL,
          vehicle_name TEXT NOT NULL,
          vehicle_image TEXT,
          vehicle_photo TEXT,
          city TEXT NOT NULL,
          category TEXT NOT NULL,
          shop_name TEXT NOT NULL,
          shop_address TEXT NOT NULL,
          shop_latitude DOUBLE PRECISION,
          shop_longitude DOUBLE PRECISION,
          rental_mode TEXT NOT NULL,
          pickup_datetime TIMESTAMPTZ NOT NULL,
          return_datetime TIMESTAMPTZ NOT NULL,
          days INT NOT NULL DEFAULT 0,
          hours INT NOT NULL DEFAULT 0,
          quantity INT NOT NULL DEFAULT 1,
          price_per_day INT NOT NULL,
          price_per_hour INT NOT NULL,
          rental_cost INT NOT NULL,
          security_deposit INT NOT NULL,
          total_payable_online INT NOT NULL,
          total_payable_at_shop INT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Upcoming',
          payment_status TEXT NOT NULL DEFAULT 'Pending',
          utr_number TEXT,
          payment_screenshot_url TEXT,
          payment_note TEXT,
          partner_booking_id TEXT,
          payment_submitted_at TIMESTAMPTZ,
          payment_verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      // Idempotent upgrade path for databases created before manual-UPI payment existed.
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending';`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS utr_number TEXT;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS payment_note TEXT;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS partner_booking_id TEXT;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS shop_latitude DOUBLE PRECISION;`);
      await db.query(`ALTER TABLE customer_bookings ADD COLUMN IF NOT EXISTS shop_longitude DOUBLE PRECISION;`);

      await db.query(`
        CREATE TABLE IF NOT EXISTS contact_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          contact TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    })();
  }
  return schemaReady;
}

export interface DbUser {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
  created_at: string;
}

/** Finds a user by phone, creating one on first login (matches the "create if new" flow). */
export async function findOrCreateUserByPhone(phone: string): Promise<DbUser> {
  await ensureSchema();
  const db = getPool();

  const existing = await db.query<DbUser>("SELECT * FROM users WHERE phone = $1", [phone]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await db.query<DbUser>(
    `INSERT INTO users (phone, name) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING *`,
    [phone, "Rento User"]
  );
  return inserted.rows[0];
}

export async function getUserById(id: string): Promise<DbUser | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<DbUser>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function updateUserProfile(
  id: string,
  data: { name?: string; gender?: string; city?: string }
): Promise<DbUser> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<DbUser>(
    `UPDATE users SET
       name = COALESCE($2, name),
       gender = COALESCE($3, gender),
       city = COALESCE($4, city)
     WHERE id = $1
     RETURNING *`,
    [id, data.name ?? null, data.gender ?? null, data.city ?? null]
  );
  return result.rows[0];
}

interface BookingRow {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_image: string | null;
  vehicle_photo: string | null;
  city: string;
  category: string;
  shop_name: string;
  shop_address: string;
  shop_latitude: number | null;
  shop_longitude: number | null;
  rental_mode: string;
  pickup_datetime: string;
  return_datetime: string;
  days: number;
  hours: number;
  quantity: number;
  price_per_day: number;
  price_per_hour: number;
  rental_cost: number;
  security_deposit: number;
  total_payable_online: number;
  total_payable_at_shop: number;
  status: string;
  payment_status: string;
  utr_number: string | null;
  payment_screenshot_url: string | null;
  payment_note: string | null;
  partner_booking_id: string | null;
  created_at: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    vehicleImage: row.vehicle_image ?? "",
    vehiclePhoto: row.vehicle_photo ?? undefined,
    city: row.city as Booking["city"],
    category: row.category as Booking["category"],
    shop: {
      name: row.shop_name,
      address: row.shop_address,
      latitude: row.shop_latitude,
      longitude: row.shop_longitude,
    },
    rentalMode: row.rental_mode as Booking["rentalMode"],
    pickupDateTime: row.pickup_datetime,
    returnDateTime: row.return_datetime,
    days: row.days,
    hours: row.hours,
    quantity: row.quantity,
    pricePerDay: row.price_per_day,
    pricePerHour: row.price_per_hour,
    rentalCost: row.rental_cost,
    securityDeposit: row.security_deposit,
    totalPayableOnline: row.total_payable_online,
    totalPayableAtShop: row.total_payable_at_shop,
    status: row.status as Booking["status"],
    paymentStatus: row.payment_status as Booking["paymentStatus"],
    utrNumber: row.utr_number ?? undefined,
    paymentScreenshotUrl: row.payment_screenshot_url ?? undefined,
    paymentNote: row.payment_note,
    createdAt: row.created_at,
  };
}

/** Persists a booking made by a logged-in customer. */
export async function createCustomerBooking(
  userId: string,
  booking: Booking,
  partnerBookingId: string | null
): Promise<Booking> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<BookingRow>(
    `INSERT INTO customer_bookings
       (id, user_id, vehicle_id, vehicle_name, vehicle_image, vehicle_photo, city, category,
        shop_name, shop_address, shop_latitude, shop_longitude, rental_mode, pickup_datetime, return_datetime, days, hours,
        quantity, price_per_day, price_per_hour, rental_cost, security_deposit,
        total_payable_online, total_payable_at_shop, status, partner_booking_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     RETURNING *`,
    [
      booking.id,
      userId,
      booking.vehicleId,
      booking.vehicleName,
      booking.vehicleImage || null,
      booking.vehiclePhoto ?? null,
      booking.city,
      booking.category,
      booking.shop.name,
      booking.shop.address,
      booking.shop.latitude ?? null,
      booking.shop.longitude ?? null,
      booking.rentalMode,
      booking.pickupDateTime,
      booking.returnDateTime,
      booking.days,
      booking.hours,
      booking.quantity,
      booking.pricePerDay,
      booking.pricePerHour,
      booking.rentalCost,
      booking.securityDeposit,
      booking.totalPayableOnline,
      booking.totalPayableAtShop,
      booking.status,
      partnerBookingId,
    ]
  );
  return toBooking(result.rows[0]);
}

export async function getBookingsForUser(userId: string): Promise<Booking[]> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<BookingRow>(
    "SELECT * FROM customer_bookings WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows.map(toBooking);
}

export async function getBookingForUser(id: string, userId: string): Promise<Booking | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<BookingRow>(
    "SELECT * FROM customer_bookings WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] ? toBooking(result.rows[0]) : null;
}

/** Raw row (includes partner_booking_id) — needed internally to sync the mirrored portal booking. */
async function getBookingRowForUser(id: string, userId: string): Promise<BookingRow | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<BookingRow>(
    "SELECT * FROM customer_bookings WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] ?? null;
}

const UTR_REGEX = /^[A-Za-z0-9]{6,24}$/;

export function isValidUtr(value: string): boolean {
  return UTR_REGEX.test(value.trim());
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
 */
export async function submitBookingPayment(
  bookingId: string,
  userId: string,
  utrNumber: string,
  screenshotUrl: string | null
): Promise<SubmitPaymentResult> {
  await ensureSchema();
  const db = getPool();

  const existing = await getBookingRowForUser(bookingId, userId);
  if (!existing) return { ok: false, error: "Booking not found" };
  if (existing.payment_status === "Verified") {
    return { ok: false, error: "This booking's payment is already verified." };
  }

  const trimmedUtr = utrNumber.trim();
  if (!isValidUtr(trimmedUtr)) {
    return { ok: false, error: "Enter a valid UPI transaction reference (UTR) number." };
  }

  // A UTR that's already attached to a different Submitted/Verified booking is either a
  // mistake or an attempt to reuse one real payment as proof for multiple bookings.
  const dupe = await db.query<{ id: string }>(
    `SELECT id FROM customer_bookings
     WHERE utr_number = $1 AND id != $2 AND payment_status IN ('Submitted', 'Verified')`,
    [trimmedUtr, bookingId]
  );
  if (dupe.rows[0]) {
    return { ok: false, error: "This transaction reference has already been used for another booking." };
  }

  const result = await db.query<BookingRow>(
    `UPDATE customer_bookings SET
       payment_status = 'Submitted',
       utr_number = $3,
       payment_screenshot_url = COALESCE($4, payment_screenshot_url),
       payment_note = NULL,
       payment_submitted_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [bookingId, userId, trimmedUtr, screenshotUrl]
  );

  return { ok: true, booking: toBooking(result.rows[0]), partnerBookingId: existing.partner_booking_id };
}

export async function createContactMessage(data: {
  name: string;
  contact: string;
  message: string;
}): Promise<void> {
  await ensureSchema();
  const db = getPool();
  await db.query(
    "INSERT INTO contact_messages (name, contact, message) VALUES ($1, $2, $3)",
    [data.name, data.contact, data.message]
  );
}
