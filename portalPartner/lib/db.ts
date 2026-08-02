import { Pool } from "@/node_modules/@types/pg";
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
      try {
        await db.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      } catch {
        // best-effort — gen_random_uuid() is likely already available natively
      }

      await db.query(`
        CREATE TABLE IF NOT EXISTS shop_owners (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_name TEXT NOT NULL,
          shop_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          phone TEXT NOT NULL,
          city TEXT NOT NULL,
          address TEXT NOT NULL,
          pincode TEXT,
          status TEXT NOT NULL DEFAULT 'Pending',
          rejection_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      // Idempotent upgrade path for databases created before the Admin portal existed —
      // CREATE TABLE IF NOT EXISTS above is a no-op once the table already exists.
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';`);
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
      // Precise pickup coordinates, captured via the browser's Geolocation API on the Shop
      // Profile page — optional, since the free-text address alone is enough to get started.
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;`);
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;`);

      await db.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id UUID NOT NULL REFERENCES shop_owners(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          engine_label TEXT NOT NULL DEFAULT '',
          photo_url TEXT,
          price_per_day INT NOT NULL,
          price_per_hour INT NOT NULL,
          security_deposit INT NOT NULL,
          stock INT NOT NULL DEFAULT 1,
          fuel TEXT NOT NULL DEFAULT 'Petrol',
          transmission TEXT NOT NULL DEFAULT 'Manual',
          seats INT NOT NULL DEFAULT 2,
          mileage TEXT NOT NULL DEFAULT '',
          features TEXT[] NOT NULL DEFAULT '{}',
          description TEXT,
          city TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id UUID NOT NULL REFERENCES shop_owners(id) ON DELETE CASCADE,
          vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          pickup_datetime TIMESTAMPTZ NOT NULL,
          return_datetime TIMESTAMPTZ NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          total_amount INT NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Upcoming',
          payment_status TEXT NOT NULL DEFAULT 'Pending',
          utr_number TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      // Idempotent upgrade path for databases created before manual-UPI payment existed.
      await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending';`);
      await db.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utr_number TEXT;`);

      // Multi-photo galleries — photo_url (singular) is kept in sync as photo_urls[1] so
      // portalAdmin and rentoCustomer, which only ever read the single column, keep working
      // unchanged and always see a sensible "cover" image.
      await db.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';`);
      await db.query(`
        UPDATE vehicles SET photo_urls = ARRAY[photo_url]
        WHERE photo_url IS NOT NULL AND photo_url <> '' AND array_length(photo_urls, 1) IS NULL;
      `);
    })();
  }
  return schemaReady;
}

// ---------- Row shapes ----------

interface OwnerRow {
  id: string;
  owner_name: string;
  shop_name: string;
  email: string;
  password_hash: string;
  phone: string;
  city: string;
  address: string;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface VehicleRow {
  id: string;
  owner_id: string;
  category: string;
  name: string;
  brand: string;
  engine_label: string;
  photo_url: string | null;
  photo_urls: string[];
  price_per_day: number;
  price_per_hour: number;
  security_deposit: number;
  stock: number;
  fuel: string;
  transmission: string;
  seats: number;
  mileage: string;
  features: string[];
  description: string | null;
  city: string;
  status: string;
  created_at: string;
}

interface BookingRow {
  id: string;
  owner_id: string;
  vehicle_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_datetime: string;
  return_datetime: string;
  quantity: number;
  total_amount: number;
  status: string;
  payment_status: string;
  utr_number: string | null;
  created_at: string;
  vehicle_name?: string;
  vehicle_photo_url?: string | null;
}

function toOwner(row: OwnerRow): ShopOwner & { passwordHash: string } {
  return {
    id: row.id,
    ownerName: row.owner_name,
    shopName: row.shop_name,
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    city: row.city,
    address: row.address,
    pincode: row.pincode,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status as ShopOwner["status"],
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    ownerId: row.owner_id,
    category: row.category as Category,
    name: row.name,
    brand: row.brand,
    engineLabel: row.engine_label,
    photoUrl: row.photo_url,
    photoUrls: row.photo_urls?.length ? row.photo_urls : row.photo_url ? [row.photo_url] : [],
    pricePerDay: row.price_per_day,
    pricePerHour: row.price_per_hour,
    securityDeposit: row.security_deposit,
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
    createdAt: row.created_at,
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    ownerId: row.owner_id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name ?? "",
    vehiclePhotoUrl: row.vehicle_photo_url ?? null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    pickupDateTime: row.pickup_datetime,
    returnDateTime: row.return_datetime,
    quantity: row.quantity,
    totalAmount: row.total_amount,
    status: row.status as BookingStatus,
    paymentStatus: row.payment_status as Booking["paymentStatus"],
    utrNumber: row.utr_number,
    createdAt: row.created_at,
  };
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
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>(
    `INSERT INTO shop_owners (owner_name, shop_name, email, password_hash, phone, city, address, pincode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.ownerName,
      data.shopName,
      data.email.toLowerCase(),
      data.passwordHash,
      data.phone,
      data.city,
      data.address,
      data.pincode,
    ]
  );
  const { passwordHash: _drop, ...owner } = toOwner(result.rows[0]);
  return owner;
}

export async function findOwnerByEmailWithHash(
  email: string
): Promise<(ShopOwner & { passwordHash: string }) | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>("SELECT * FROM shop_owners WHERE email = $1", [
    email.toLowerCase(),
  ]);
  return result.rows[0] ? toOwner(result.rows[0]) : null;
}

export async function getOwnerById(id: string): Promise<ShopOwner | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>("SELECT * FROM shop_owners WHERE id = $1", [id]);
  if (!result.rows[0]) return null;
  const { passwordHash: _drop, ...owner } = toOwner(result.rows[0]);
  return owner;
}

export async function updateOwnerProfile(
  id: string,
  data: { ownerName?: string; shopName?: string; phone?: string; city?: string; address?: string; pincode?: string | null }
): Promise<ShopOwner> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>(
    `UPDATE shop_owners SET
       owner_name = COALESCE($2, owner_name),
       shop_name = COALESCE($3, shop_name),
       phone = COALESCE($4, phone),
       city = COALESCE($5, city),
       address = COALESCE($6, address),
       pincode = COALESCE($7, pincode),
       -- The precise pin is set exclusively by Rento admin, verified against the
       -- address text at the time they set it. If the owner then edits that text,
       -- the old pin may no longer match the new address — clear it so the shop
       -- shows a plain geocoded fallback instead of a silently-stale "verified" pin,
       -- until admin re-reviews and re-confirms the location.
       latitude = CASE WHEN $6 IS NOT NULL AND $6 IS DISTINCT FROM address THEN NULL ELSE latitude END,
       longitude = CASE WHEN $6 IS NOT NULL AND $6 IS DISTINCT FROM address THEN NULL ELSE longitude END
     WHERE id = $1
     RETURNING *`,
    [id, data.ownerName ?? null, data.shopName ?? null, data.phone ?? null, data.city ?? null, data.address ?? null, data.pincode ?? null]
  );
  const { passwordHash: _drop, ...owner } = toOwner(result.rows[0]);
  return owner;
}

export async function updateOwnerPassword(id: string, passwordHash: string): Promise<void> {
  await ensureSchema();
  const db = getPool();
  await db.query("UPDATE shop_owners SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}

/** After a rejection, lets the owner send their (presumably updated) profile back for review. */
export async function resubmitOwnerForReview(id: string): Promise<ShopOwner | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>(
    `UPDATE shop_owners SET status = 'Pending', rejection_reason = NULL
     WHERE id = $1 AND status = 'Rejected'
     RETURNING *`,
    [id]
  );
  if (!result.rows[0]) return null;
  const { passwordHash: _drop, ...owner } = toOwner(result.rows[0]);
  return owner;
}

// ---------- Vehicles ----------

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
  await ensureSchema();
  const db = getPool();
  const result = await db.query<VehicleRow>(
    `INSERT INTO vehicles
       (owner_id, category, name, brand, engine_label, photo_url, photo_urls, price_per_day, price_per_hour,
        security_deposit, stock, fuel, transmission, seats, mileage, features, description, city)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      data.ownerId,
      data.category,
      data.name,
      data.brand,
      data.engineLabel,
      data.photoUrls[0] ?? null,
      data.photoUrls,
      data.pricePerDay,
      data.pricePerHour,
      data.securityDeposit,
      data.stock,
      data.fuel,
      data.transmission,
      data.seats,
      data.mileage,
      data.features,
      data.description,
      data.city,
    ]
  );
  return toVehicle(result.rows[0]);
}

export async function getVehiclesForOwner(ownerId: string): Promise<Vehicle[]> {
  await ensureSchema();
  const db = getPool();
  // Same "what actually holds a unit" rule used for the customer-facing availability
  // check: Submitted/Verified payments always hold it, a Pending payment only holds it
  // for 30 minutes (abandoned checkouts release automatically), Rejected never holds it.
  const result = await db.query<VehicleRow & { booked: string }>(
    `SELECT v.*,
       COALESCE((
         SELECT SUM(b.quantity) FROM bookings b
         WHERE b.vehicle_id = v.id AND b.status = 'Upcoming'
           AND (
             b.payment_status IN ('Submitted', 'Verified')
             OR (b.payment_status = 'Pending' AND b.created_at > now() - interval '30 minutes')
           )
       ), 0)::text AS booked
     FROM vehicles v
     WHERE v.owner_id = $1
     ORDER BY v.created_at DESC`,
    [ownerId]
  );
  return result.rows.map((row) => ({
    ...toVehicle(row),
    availableStock: Math.max(0, row.stock - Number(row.booked)),
  }));
}

export async function getVehicleForOwner(id: string, ownerId: string): Promise<Vehicle | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<VehicleRow>(
    "SELECT * FROM vehicles WHERE id = $1 AND owner_id = $2",
    [id, ownerId]
  );
  return result.rows[0] ? toVehicle(result.rows[0]) : null;
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
  await ensureSchema();
  const db = getPool();
  const result = await db.query<VehicleRow>(
    `UPDATE vehicles SET
       category = COALESCE($3, category),
       name = COALESCE($4, name),
       brand = COALESCE($5, brand),
       engine_label = COALESCE($6, engine_label),
       photo_urls = COALESCE($7, photo_urls),
       photo_url = (COALESCE($7, photo_urls))[1],
       price_per_day = COALESCE($8, price_per_day),
       price_per_hour = COALESCE($9, price_per_hour),
       security_deposit = COALESCE($10, security_deposit),
       stock = COALESCE($11, stock),
       fuel = COALESCE($12, fuel),
       transmission = COALESCE($13, transmission),
       seats = COALESCE($14, seats),
       mileage = COALESCE($15, mileage),
       features = COALESCE($16, features),
       description = COALESCE($17, description),
       city = COALESCE($18, city),
       status = COALESCE($19, status)
     WHERE id = $1 AND owner_id = $2
     RETURNING *`,
    [
      id,
      ownerId,
      data.category ?? null,
      data.name ?? null,
      data.brand ?? null,
      data.engineLabel ?? null,
      data.photoUrls ?? null,
      data.pricePerDay ?? null,
      data.pricePerHour ?? null,
      data.securityDeposit ?? null,
      data.stock ?? null,
      data.fuel ?? null,
      data.transmission ?? null,
      data.seats ?? null,
      data.mileage ?? null,
      data.features ?? null,
      data.description ?? null,
      data.city ?? null,
      data.status ?? null,
    ]
  );
  return result.rows[0] ? toVehicle(result.rows[0]) : null;
}

export async function deleteVehicle(id: string, ownerId: string): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query("DELETE FROM vehicles WHERE id = $1 AND owner_id = $2", [
    id,
    ownerId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// ---------- Bookings ----------

export async function getBookingsForOwner(ownerId: string): Promise<Booking[]> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<BookingRow>(
    `SELECT b.*, v.name AS vehicle_name, v.photo_url AS vehicle_photo_url
     FROM bookings b
     JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.owner_id = $1
     ORDER BY b.pickup_datetime DESC`,
    [ownerId]
  );
  return result.rows.map(toBooking);
}

export async function updateBookingStatus(
  id: string,
  ownerId: string,
  status: BookingStatus
): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query(
    "UPDATE bookings SET status = $3 WHERE id = $1 AND owner_id = $2",
    [id, ownerId, status]
  );
  const updated = (result.rowCount ?? 0) > 0;

  // Best-effort: reflect the change back into the customer's own booking record too
  // (a different app's table, rentoCustomer/customer_bookings, in this same database)
  // — otherwise a customer's "My Bookings" page would show "Upcoming" forever even
  // after the shop owner marks the rental Completed or Cancelled.
  if (updated) {
    try {
      await db.query(
        "UPDATE customer_bookings SET status = $2 WHERE partner_booking_id = $1",
        [id, status]
      );
    } catch (err) {
      console.error("Failed to sync booking status back to rentoCustomer:", err);
    }
  }

  return updated;
}
