import { Pool } from "pg";

// Payment submissions live in rentoCustomer's own customer_bookings/users tables —
// a different app's "territory" in the shared database, but this app needs to review
// and verify them platform-wide. Read/write only what's needed for that; never touch
// rentoCustomer's schema itself (it owns creating these tables).
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

// Payment screenshots are uploaded to rentoCustomer's own server, not this one.
const RENTO_CUSTOMER_ORIGIN = process.env.RENTO_CUSTOMER_ORIGIN || "http://localhost:3000";

function resolveUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${RENTO_CUSTOMER_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

export interface PendingPayment {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehiclePhoto: string | null;
  city: string;
  quantity: number;
  totalPayableOnline: number;
  utrNumber: string | null;
  paymentScreenshotUrl: string | null;
  paymentSubmittedAt: string | null;
  createdAt: string;
}

interface PendingPaymentRow {
  id: string;
  vehicle_name: string;
  vehicle_photo: string | null;
  city: string;
  quantity: number;
  total_payable_online: number;
  utr_number: string | null;
  payment_screenshot_url: string | null;
  payment_submitted_at: string | null;
  created_at: string;
  name: string;
  phone: string;
}

/** All bookings awaiting manual payment verification, across every customer. */
export async function listPendingPayments(): Promise<PendingPayment[]> {
  const db = getPool();
  if (!db) return [];

  try {
    const result = await db.query<PendingPaymentRow>(`
      SELECT cb.id, cb.vehicle_name, cb.vehicle_photo, cb.city, cb.quantity,
             cb.total_payable_online, cb.utr_number, cb.payment_screenshot_url,
             cb.payment_submitted_at, cb.created_at, u.name, u.phone
      FROM customer_bookings cb
      JOIN users u ON u.id = cb.user_id
      WHERE cb.payment_status = 'Submitted'
      ORDER BY cb.payment_submitted_at ASC NULLS LAST
    `);

    return result.rows.map((row) => ({
      id: row.id,
      customerName: row.name,
      customerPhone: row.phone,
      vehicleName: row.vehicle_name,
      vehiclePhoto: resolveUrl(row.vehicle_photo),
      city: row.city,
      quantity: row.quantity,
      totalPayableOnline: row.total_payable_online,
      utrNumber: row.utr_number,
      paymentScreenshotUrl: resolveUrl(row.payment_screenshot_url),
      paymentSubmittedAt: row.payment_submitted_at,
      createdAt: row.created_at,
    }));
  } catch (err) {
    // rentoCustomer's tables may not exist yet (fresh DB, or it's never been run) —
    // degrade to "nothing pending" rather than breaking the admin console.
    console.error("Failed to load pending payments:", err);
    return [];
  }
}

async function syncMirroredBookingPayment(
  db: Pool,
  partnerBookingId: string | null,
  paymentStatus: string
): Promise<void> {
  if (!partnerBookingId) return;
  try {
    await db.query("UPDATE bookings SET payment_status = $2 WHERE id = $1", [
      partnerBookingId,
      paymentStatus,
    ]);
  } catch (err) {
    console.error("Failed to sync payment status into shop owner's portal:", err);
  }
}

export async function verifyPayment(bookingId: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;

  const result = await db.query<{ partner_booking_id: string | null }>(
    `UPDATE customer_bookings
     SET payment_status = 'Verified', payment_verified_at = now(), payment_note = NULL
     WHERE id = $1 AND payment_status = 'Submitted'
     RETURNING partner_booking_id`,
    [bookingId]
  );
  if (!result.rows[0]) return false;

  await syncMirroredBookingPayment(db, result.rows[0].partner_booking_id, "Verified");
  return true;
}

export async function rejectPayment(bookingId: string, reason: string): Promise<boolean> {
  const db = getPool();
  if (!db) return false;

  const result = await db.query<{ partner_booking_id: string | null }>(
    `UPDATE customer_bookings
     SET payment_status = 'Rejected', payment_note = $2
     WHERE id = $1 AND payment_status = 'Submitted'
     RETURNING partner_booking_id`,
    [bookingId, reason]
  );
  if (!result.rows[0]) return false;

  await syncMirroredBookingPayment(db, result.rows[0].partner_booking_id, "Rejected");
  return true;
}
