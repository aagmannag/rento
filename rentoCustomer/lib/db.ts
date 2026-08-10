import { Prisma, prisma } from "@rento/db";
import type { Booking } from "./types";

export interface DbUser {
  id: string;
  phone: string;
  name: string;
  gender: string | null;
  city: string | null;
  created_at: string;
}

function toDbUser(row: { id: string; phone: string; name: string; gender: string | null; city: string | null; createdAt: Date }): DbUser {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    gender: row.gender,
    city: row.city,
    created_at: row.createdAt.toISOString(),
  };
}

/** Finds a user by phone, creating one on first login (matches the "create if new" flow). */
export async function findOrCreateUserByPhone(phone: string): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return toDbUser(existing);

  // Race-safe: if two requests for a brand-new phone number land at once, one insert
  // wins and the other hits the unique constraint — fall back to reading the row the
  // winner just created rather than surfacing a 500.
  try {
    const created = await prisma.user.create({ data: { phone, name: "Rento User" } });
    return toDbUser(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.user.findUnique({ where: { phone } });
      if (row) return toDbUser(row);
    }
    throw err;
  }
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toDbUser(row) : null;
}

export async function updateUserProfile(
  id: string,
  data: { name?: string; gender?: string; city?: string }
): Promise<DbUser> {
  const row = await prisma.user.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      gender: data.gender ?? undefined,
      city: data.city ?? undefined,
    },
  });
  return toDbUser(row);
}

function toBooking(row: {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleImage: string | null;
  vehiclePhoto: string | null;
  city: string;
  category: string;
  shopName: string;
  shopAddress: string;
  shopLatitude: number | null;
  shopLongitude: number | null;
  rentalMode: string;
  pickupDateTime: Date;
  returnDateTime: Date;
  days: number;
  hours: number;
  quantity: number;
  pricePerDay: number;
  pricePerHour: number;
  rentalCost: number;
  securityDeposit: number;
  totalPayableOnline: number;
  totalPayableAtShop: number;
  status: string;
  paymentStatus: string;
  utrNumber: string | null;
  paymentScreenshotUrl: string | null;
  paymentNote: string | null;
  createdAt: Date;
}): Booking {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicleName: row.vehicleName,
    vehicleImage: row.vehicleImage ?? "",
    vehiclePhoto: row.vehiclePhoto ?? undefined,
    city: row.city as Booking["city"],
    category: row.category as Booking["category"],
    shop: {
      name: row.shopName,
      address: row.shopAddress,
      latitude: row.shopLatitude,
      longitude: row.shopLongitude,
    },
    rentalMode: row.rentalMode as Booking["rentalMode"],
    pickupDateTime: row.pickupDateTime.toISOString(),
    returnDateTime: row.returnDateTime.toISOString(),
    days: row.days,
    hours: row.hours,
    quantity: row.quantity,
    pricePerDay: row.pricePerDay,
    pricePerHour: row.pricePerHour,
    rentalCost: row.rentalCost,
    securityDeposit: row.securityDeposit,
    totalPayableOnline: row.totalPayableOnline,
    totalPayableAtShop: row.totalPayableAtShop,
    status: row.status as Booking["status"],
    paymentStatus: row.paymentStatus as Booking["paymentStatus"],
    utrNumber: row.utrNumber ?? undefined,
    paymentScreenshotUrl: row.paymentScreenshotUrl ?? undefined,
    paymentNote: row.paymentNote,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Persists a booking made by a logged-in customer. */
export async function createCustomerBooking(
  userId: string,
  booking: Booking,
  partnerBookingId: string | null
): Promise<Booking> {
  const row = await prisma.customerBooking.create({
    data: {
      id: booking.id,
      userId,
      vehicleId: booking.vehicleId,
      vehicleName: booking.vehicleName,
      vehicleImage: booking.vehicleImage || null,
      vehiclePhoto: booking.vehiclePhoto ?? null,
      city: booking.city,
      category: booking.category,
      shopName: booking.shop.name,
      shopAddress: booking.shop.address,
      shopLatitude: booking.shop.latitude ?? null,
      shopLongitude: booking.shop.longitude ?? null,
      rentalMode: booking.rentalMode,
      pickupDateTime: booking.pickupDateTime,
      returnDateTime: booking.returnDateTime,
      days: booking.days,
      hours: booking.hours,
      quantity: booking.quantity,
      pricePerDay: booking.pricePerDay,
      pricePerHour: booking.pricePerHour,
      rentalCost: booking.rentalCost,
      securityDeposit: booking.securityDeposit,
      totalPayableOnline: booking.totalPayableOnline,
      totalPayableAtShop: booking.totalPayableAtShop,
      status: booking.status,
      partnerBookingId,
    },
  });
  return toBooking(row);
}

export async function getBookingsForUser(userId: string): Promise<Booking[]> {
  const rows = await prisma.customerBooking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toBooking);
}

export async function getBookingForUser(id: string, userId: string): Promise<Booking | null> {
  const row = await prisma.customerBooking.findFirst({ where: { id, userId } });
  return row ? toBooking(row) : null;
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
  const existing = await prisma.customerBooking.findFirst({ where: { id: bookingId, userId } });
  if (!existing) return { ok: false, error: "Booking not found" };
  if (existing.paymentStatus === "Verified") {
    return { ok: false, error: "This booking's payment is already verified." };
  }

  const trimmedUtr = utrNumber.trim();
  if (!isValidUtr(trimmedUtr)) {
    return { ok: false, error: "Enter a valid UPI transaction reference (UTR) number." };
  }

  // A UTR that's already attached to a different Submitted/Verified booking is either a
  // mistake or an attempt to reuse one real payment as proof for multiple bookings.
  const dupe = await prisma.customerBooking.findFirst({
    where: { utrNumber: trimmedUtr, id: { not: bookingId }, paymentStatus: { in: ["Submitted", "Verified"] } },
    select: { id: true },
  });
  if (dupe) {
    return { ok: false, error: "This transaction reference has already been used for another booking." };
  }

  try {
    const row = await prisma.customerBooking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: "Submitted",
        utrNumber: trimmedUtr,
        paymentScreenshotUrl: screenshotUrl ?? undefined,
        paymentNote: null,
        paymentSubmittedAt: new Date(),
      },
    });
    return { ok: true, booking: toBooking(row), partnerBookingId: existing.partnerBookingId };
  } catch (err) {
    // Belt-and-braces: the DB also enforces this via a partial unique index on
    // (utr_number) WHERE payment_status IN ('Submitted','Verified'), closing the race
    // window between the check above and this update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "This transaction reference has already been used for another booking." };
    }
    throw err;
  }
}

export async function createContactMessage(data: {
  name: string;
  contact: string;
  message: string;
}): Promise<void> {
  await prisma.contactMessage.create({ data });
}
