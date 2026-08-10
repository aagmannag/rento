import { prisma } from "@rento/db";

// Payment submissions live in rentoCustomer's own customer_bookings/users tables —
// a different app's "territory" in the shared database, but this app needs to review
// and verify them platform-wide.
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

/** All bookings awaiting manual payment verification, across every customer. */
export async function listPendingPayments(): Promise<PendingPayment[]> {
  try {
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
    }));
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
  return true;
}
