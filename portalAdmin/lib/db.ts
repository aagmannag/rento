import { Pool } from "pg";
import type {
  AdminUser,
  Category,
  OwnerApprovalStatus,
  PlatformStats,
  ShopOwner,
  ShopOwnerDetail,
  Vehicle,
  VehicleStatus,
} from "./types";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

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

// This app shares a database with portalForShopOwner (see .env.local.example) but may
// be the first of the two to ever run against a fresh database — so it defensively
// creates the exact same shop_owners/vehicles/bookings schema (all IF NOT EXISTS,
// safe no-ops if portalForShopOwner already created them) plus its own admin_users table.
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
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

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
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';`);
      await db.query(`ALTER TABLE shop_owners ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
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
    })();
  }
  return schemaReady;
}

// ---------- Row shapes ----------

interface AdminRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface OwnerRow {
  id: string;
  owner_name: string;
  shop_name: string;
  email: string;
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

interface OwnerVehicleRow {
  id: string;
  category: string;
  name: string;
  brand: string;
  photo_url: string | null;
  price_per_day: number;
  stock: number;
  city: string;
  status: string;
}

function toAdmin(row: AdminRow): AdminUser & { passwordHash: string } {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function toOwner(row: OwnerRow): ShopOwner {
  return {
    id: row.id,
    ownerName: row.owner_name,
    shopName: row.shop_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    address: row.address,
    pincode: row.pincode,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status as OwnerApprovalStatus,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

// ---------- Admin users ----------

export async function adminCount(): Promise<number> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_users");
  return Number(result.rows[0]?.count ?? "0");
}

export async function createFirstAdmin(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AdminUser> {
  await ensureSchema();
  const db = getPool();

  // Guard against a race between the "does an admin exist" check and this insert —
  // the setup screen should only ever be usable once.
  const existing = await adminCount();
  if (existing > 0) {
    throw new Error("An admin account already exists.");
  }

  const result = await db.query<AdminRow>(
    `INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.email.toLowerCase(), data.passwordHash]
  );
  const { passwordHash: _drop, ...admin } = toAdmin(result.rows[0]);
  return admin;
}

export async function findAdminByEmailWithHash(
  email: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<AdminRow>("SELECT * FROM admin_users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  return result.rows[0] ? toAdmin(result.rows[0]) : null;
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<AdminRow>("SELECT * FROM admin_users WHERE id = $1", [id]);
  if (!result.rows[0]) return null;
  const { passwordHash: _drop, ...admin } = toAdmin(result.rows[0]);
  return admin;
}

export async function getAdminByIdWithHash(
  id: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<AdminRow>("SELECT * FROM admin_users WHERE id = $1", [id]);
  return result.rows[0] ? toAdmin(result.rows[0]) : null;
}

export async function updateAdminPassword(id: string, passwordHash: string): Promise<void> {
  await ensureSchema();
  const db = getPool();
  await db.query("UPDATE admin_users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}

export async function updateAdminName(id: string, name: string): Promise<AdminUser> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<AdminRow>(
    "UPDATE admin_users SET name = $2 WHERE id = $1 RETURNING *",
    [id, name]
  );
  const { passwordHash: _drop, ...admin } = toAdmin(result.rows[0]);
  return admin;
}

// ---------- Shop owner review ----------

export async function listShopOwners(status?: OwnerApprovalStatus): Promise<ShopOwner[]> {
  await ensureSchema();
  const db = getPool();
  const result = status
    ? await db.query<OwnerRow>("SELECT * FROM shop_owners WHERE status = $1 ORDER BY created_at DESC", [status])
    : await db.query<OwnerRow>("SELECT * FROM shop_owners ORDER BY created_at DESC");
  return result.rows.map(toOwner);
}

export async function getShopOwnerDetail(id: string): Promise<ShopOwnerDetail | null> {
  await ensureSchema();
  const db = getPool();

  const ownerResult = await db.query<OwnerRow>("SELECT * FROM shop_owners WHERE id = $1", [id]);
  if (!ownerResult.rows[0]) return null;
  const owner = toOwner(ownerResult.rows[0]);

  const vehiclesResult = await db.query<OwnerVehicleRow>(
    `SELECT id, category, name, brand, photo_url, price_per_day, stock, city, status
     FROM vehicles WHERE owner_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const statsResult = await db.query<{ total_bookings: string; total_earnings: string }>(
    `SELECT COUNT(*)::text AS total_bookings,
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'Completed'), 0)::text AS total_earnings
     FROM bookings WHERE owner_id = $1`,
    [id]
  );

  return {
    ...owner,
    vehicles: vehiclesResult.rows.map((v) => ({
      id: v.id,
      category: v.category as Category,
      name: v.name,
      brand: v.brand,
      photoUrl: resolvePhotoUrl(v.photo_url),
      pricePerDay: v.price_per_day,
      stock: v.stock,
      city: v.city,
      status: v.status as VehicleStatus,
    })),
    totalBookings: Number(statsResult.rows[0]?.total_bookings ?? "0"),
    totalEarnings: Number(statsResult.rows[0]?.total_earnings ?? "0"),
  };
}

async function setOwnerStatus(
  id: string,
  fromStatuses: OwnerApprovalStatus[],
  toStatus: OwnerApprovalStatus,
  rejectionReason: string | null = null
): Promise<ShopOwner | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>(
    `UPDATE shop_owners SET status = $2, rejection_reason = $3
     WHERE id = $1 AND status = ANY($4::text[])
     RETURNING *`,
    [id, toStatus, rejectionReason, fromStatuses]
  );
  return result.rows[0] ? toOwner(result.rows[0]) : null;
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
 *  real map and marks the exact point, which is what customers actually see. Uses direct
 *  assignment (not COALESCE) so passing null actually clears a previously-set pin. */
export async function updateOwnerLocation(
  id: string,
  latitude: number | null,
  longitude: number | null
): Promise<ShopOwner | null> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<OwnerRow>(
    `UPDATE shop_owners SET latitude = $2, longitude = $3 WHERE id = $1 RETURNING *`,
    [id, latitude, longitude]
  );
  return result.rows[0] ? toOwner(result.rows[0]) : null;
}

export async function reinstateOwner(id: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Suspended"], "Approved");
}

// ---------- Platform stats ----------

export async function getPlatformStats(): Promise<PlatformStats> {
  await ensureSchema();
  const db = getPool();

  const ownerStats = await db.query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::text AS count FROM shop_owners GROUP BY status"
  );
  const vehicleStats = await db.query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::text AS count FROM vehicles GROUP BY status"
  );
  const bookingCount = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM bookings");

  const ownersByStatus: Record<string, number> = {};
  for (const row of ownerStats.rows) ownersByStatus[row.status] = Number(row.count);

  const vehiclesByStatus: Record<string, number> = {};
  for (const row of vehicleStats.rows) vehiclesByStatus[row.status] = Number(row.count);

  return {
    totalOwners: Object.values(ownersByStatus).reduce((a, b) => a + b, 0),
    pendingOwners: ownersByStatus["Pending"] ?? 0,
    approvedOwners: ownersByStatus["Approved"] ?? 0,
    rejectedOwners: ownersByStatus["Rejected"] ?? 0,
    suspendedOwners: ownersByStatus["Suspended"] ?? 0,
    totalVehicles: Object.values(vehiclesByStatus).reduce((a, b) => a + b, 0),
    activeVehicles: vehiclesByStatus["Active"] ?? 0,
    totalBookings: Number(bookingCount.rows[0]?.count ?? "0"),
  };
}

// ---------- Vehicle moderation ----------

interface AllVehicleRow {
  id: string;
  owner_id: string;
  category: string;
  name: string;
  brand: string;
  photo_url: string | null;
  price_per_day: number;
  stock: number;
  city: string;
  status: string;
  created_at: string;
  owner_name: string;
  shop_name: string;
  owner_status: string;
}

export async function listAllVehicles(): Promise<Vehicle[]> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query<AllVehicleRow>(`
    SELECT v.id, v.owner_id, v.category, v.name, v.brand, v.photo_url, v.price_per_day,
           v.stock, v.city, v.status, v.created_at,
           o.owner_name, o.shop_name, o.status AS owner_status
    FROM vehicles v
    JOIN shop_owners o ON o.id = v.owner_id
    ORDER BY v.created_at DESC
  `);
  return result.rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    shopName: row.shop_name,
    ownerStatus: row.owner_status as OwnerApprovalStatus,
    category: row.category as Category,
    name: row.name,
    brand: row.brand,
    photoUrl: resolvePhotoUrl(row.photo_url),
    pricePerDay: row.price_per_day,
    stock: row.stock,
    city: row.city,
    status: row.status as VehicleStatus,
    createdAt: row.created_at,
  }));
}

export async function setVehicleStatus(id: string, status: VehicleStatus): Promise<boolean> {
  await ensureSchema();
  const db = getPool();
  const result = await db.query("UPDATE vehicles SET status = $2 WHERE id = $1", [id, status]);
  return (result.rowCount ?? 0) > 0;
}
