import { getCached, invalidateCache, prisma } from "@rento/db";

// Payment submissions live in rentoCustomer's own customer_bookings/users tables —
// a different app's "territory" in the shared database, but this app needs to review
// and verify them platform-wide.
const RENTO_CUSTOMER_ORIGIN = process.env.RENTO_CUSTOMER_ORIGIN || "http://localhost:3000";

// Measured via curl against a real authenticated session: ~390-770ms on EVERY call, not
// just the first — same "no caching at all" gap as the other admin dashboard queries in
// lib/db.ts (see its own comment). A short TTL here specifically (vs. those queries'
// 10s) since this is a queue admins act on directly, not just a display stat — new
// Submitted payments from rentoCustomer (cross-app, not wired to invalidate this) should
// still surface promptly. verifyPayment/rejectPayment below invalidate immediately on
// write, so this TTL is only ever the fallback for a payment that just arrived.
const PENDING_PAYMENTS_CACHE_KEY = "cache:v1:admin:pending-payments";
const PENDING_PAYMENTS_CACHE_TTL_SECONDS = 5;

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

/** All bookings awaiting manual payment verification, across every customer. */
export async function listPendingPayments(): Promise<PendingPayment[]> {
  try {
    return await getCached(PENDING_PAYMENTS_CACHE_KEY, PENDING_PAYMENTS_CACHE_TTL_SECONDS, async () => {
      // Tried relationLoadStrategy: "join" here to collapse the user include into a
      // single query (it currently runs as a second dependent query — confirmed via
      // slow-query logging, costing ~200ms extra beyond the main query's own ~230ms).
      // Reverted: it doesn't typecheck against this project's Prisma setup (the
      // driver-adapter config doesn't expose it the way a standard connection-string
      // client would), and forcing it through would mean enabling a preview feature
      // project-wide just for this one query. The cache above absorbs most of that cost
      // instead, without needing the preview feature.
      const rows = await prisma.customerBooking.findMany({
        where: { paymentStatus: "Submitted" },
        orderBy: { paymentSubmittedAt: { sort: "asc", nulls: "last" } },
        include: { user: { select: { name: true, phone: true } } },
      });

      return rows.map((row) => ({
        id: row.id,
        customerName: row.user.name,
        customerPhone: row.user.phone,
        vehicleName: row.vehicleName,
        vehiclePhoto: resolveUrl(row.vehiclePhoto),
        city: row.city,
        quantity: row.quantity,
        totalPayableOnline: row.totalPayableOnline,
        utrNumber: row.utrNumber,
        paymentScreenshotUrl: resolveUrl(row.paymentScreenshotUrl),
        paymentSubmittedAt: row.paymentSubmittedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        bookingStatus: row.status,
        refundAmount: row.refundAmount,
      }));
    });
  } catch (err) {
    console.error("Failed to load pending payments:", err);
    return [];
  }
}

async function syncMirroredBookingPayment(
  partnerBookingId: string | null,
  paymentStatus: "Verified" | "Rejected"
): Promise<void> {
  if (!partnerBookingId) return;
  try {
    await prisma.booking.update({ where: { id: partnerBookingId }, data: { paymentStatus } });
  } catch (err) {
    console.error("Failed to sync payment status into shop owner's portal:", err);
  }
}

export async function verifyPayment(bookingId: string): Promise<boolean> {
  const partnerBookingId = await prisma.$transaction(async (tx) => {
    const existing = await tx.customerBooking.findUnique({ where: { id: bookingId } });
    if (!existing || existing.paymentStatus !== "Submitted") return undefined;
    const updated = await tx.customerBooking.update({
      where: { id: bookingId },
      data: { paymentStatus: "Verified", paymentVerifiedAt: new Date(), paymentNote: null },
    });
    return updated.partnerBookingId;
  });
  if (partnerBookingId === undefined) return false;

  await syncMirroredBookingPayment(partnerBookingId, "Verified");
  // This booking just left the Submitted queue — the next load of the payments page
  // must not still show it as pending for up to PENDING_PAYMENTS_CACHE_TTL_SECONDS.
  void invalidateCache([PENDING_PAYMENTS_CACHE_KEY]);
  return true;
}

export async function rejectPayment(bookingId: string, reason: string): Promise<boolean> {
  const partnerBookingId = await prisma.$transaction(async (tx) => {
    const existing = await tx.customerBooking.findUnique({ where: { id: bookingId } });
    if (!existing || existing.paymentStatus !== "Submitted") return undefined;
    const updated = await tx.customerBooking.update({
      where: { id: bookingId },
      data: { paymentStatus: "Rejected", paymentNote: reason },
    });
    return updated.partnerBookingId;
  });
  if (partnerBookingId === undefined) return false;

  await syncMirroredBookingPayment(partnerBookingId, "Rejected");
  // Same reasoning as verifyPayment() above.
  void invalidateCache([PENDING_PAYMENTS_CACHE_KEY]);
  return true;
}
