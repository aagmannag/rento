import { bookedQuantity, prisma } from "@rento/db";
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

// Prisma returns DateTime columns as real `Date` objects; ShopOwner (./types.ts)
// declares `createdAt: string` (an ISO string, same as what these endpoints have
// always sent over the wire as JSON) — convert once here rather than at every call site.
function toOwner<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
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
  const owner = await prisma.shopOwner.create({
    data: {
      ownerName: data.ownerName,
      shopName: data.shopName,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      phone: data.phone,
      city: data.city,
      address: data.address,
      pincode: data.pincode,
    },
  });
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function findOwnerByEmailWithHash(
  email: string
): Promise<(ShopOwner & { passwordHash: string }) | null> {
  const owner = await prisma.shopOwner.findUnique({ where: { email: email.toLowerCase() } });
  return owner ? toOwner(owner) : null;
}

export async function getOwnerById(id: string): Promise<ShopOwner | null> {
  const owner = await prisma.shopOwner.findUnique({ where: { id } });
  if (!owner) return null;
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function updateOwnerProfile(
  id: string,
  data: { ownerName?: string; shopName?: string; phone?: string; city?: string; address?: string; pincode?: string | null }
): Promise<ShopOwner> {
  const owner = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopOwner.findUniqueOrThrow({ where: { id } });
    // The precise pin is set exclusively by Rento admin, verified against the address
    // text at the time they set it. If the owner then edits that text, the old pin may
    // no longer match the new address — clear it so the shop shows a plain geocoded
    // fallback instead of a silently-stale "verified" pin, until admin re-confirms.
    const addressChanged = data.address !== undefined && data.address !== existing.address;
    return tx.shopOwner.update({
      where: { id },
      data: {
        ownerName: data.ownerName ?? undefined,
        shopName: data.shopName ?? undefined,
        phone: data.phone ?? undefined,
        city: data.city ?? undefined,
        address: data.address ?? undefined,
        // Matches the original COALESCE-based update: a null/undefined pincode is a
        // no-op (can't explicitly clear it this way), any other value is applied as-is.
        pincode: data.pincode === undefined || data.pincode === null ? undefined : data.pincode,
        latitude: addressChanged ? null : undefined,
        longitude: addressChanged ? null : undefined,
      },
    });
  });
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

export async function updateOwnerPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.shopOwner.update({ where: { id }, data: { passwordHash } });
}

/** After a rejection, lets the owner send their (presumably updated) profile back for review. */
export async function resubmitOwnerForReview(id: string): Promise<ShopOwner | null> {
  const owner = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopOwner.findUnique({ where: { id } });
    if (!existing || existing.status !== "Rejected") return null;
    return tx.shopOwner.update({
      where: { id },
      data: { status: "Pending", rejectionReason: null },
    });
  });
  if (!owner) return null;
  const { passwordHash: _drop, ...rest } = toOwner(owner);
  return rest;
}

// ---------- Vehicles ----------

function toVehicle(row: {
  id: string;
  ownerId: string;
  category: string;
  name: string;
  brand: string;
  engineLabel: string;
  photoUrl: string | null;
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
  status: string;
  createdAt: Date;
}): Vehicle {
  return {
    id: row.id,
    ownerId: row.ownerId,
    category: row.category as Category,
    name: row.name,
    brand: row.brand,
    engineLabel: row.engineLabel,
    photoUrl: row.photoUrl,
    photoUrls: row.photoUrls?.length ? row.photoUrls : row.photoUrl ? [row.photoUrl] : [],
    pricePerDay: row.pricePerDay,
    pricePerHour: row.pricePerHour,
    securityDeposit: row.securityDeposit,
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
    createdAt: row.createdAt.toISOString(),
  };
}

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
  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: data.ownerId,
      category: data.category,
      name: data.name,
      brand: data.brand,
      engineLabel: data.engineLabel,
      photoUrl: data.photoUrls[0] ?? null,
      photoUrls: data.photoUrls,
      pricePerDay: data.pricePerDay,
      pricePerHour: data.pricePerHour,
      securityDeposit: data.securityDeposit,
      stock: data.stock,
      fuel: data.fuel,
      transmission: data.transmission,
      seats: data.seats,
      mileage: data.mileage,
      features: data.features,
      description: data.description,
      city: data.city,
    },
  });
  return toVehicle(vehicle);
}

export async function getVehiclesForOwner(ownerId: string): Promise<Vehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
  const withAvailability = await Promise.all(
    vehicles.map(async (v) => {
      const booked = await bookedQuantity(prisma, v.id);
      return { ...toVehicle(v), availableStock: Math.max(0, v.stock - booked) };
    })
  );
  return withAvailability;
}

export async function getVehicleForOwner(id: string, ownerId: string): Promise<Vehicle | null> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id, ownerId } });
  return vehicle ? toVehicle(vehicle) : null;
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
  const vehicle = await prisma.$transaction(async (tx) => {
    const existing = await tx.vehicle.findFirst({ where: { id, ownerId } });
    if (!existing) return null;
    return tx.vehicle.update({
      where: { id },
      data: {
        category: data.category ?? undefined,
        name: data.name ?? undefined,
        brand: data.brand ?? undefined,
        engineLabel: data.engineLabel ?? undefined,
        photoUrls: data.photoUrls ?? undefined,
        photoUrl: data.photoUrls ? data.photoUrls[0] ?? null : undefined,
        pricePerDay: data.pricePerDay ?? undefined,
        pricePerHour: data.pricePerHour ?? undefined,
        securityDeposit: data.securityDeposit ?? undefined,
        stock: data.stock ?? undefined,
        fuel: data.fuel ?? undefined,
        transmission: data.transmission ?? undefined,
        seats: data.seats ?? undefined,
        mileage: data.mileage ?? undefined,
        features: data.features ?? undefined,
        // Same COALESCE-quirk as pincode above: null/undefined is a no-op.
        description: data.description === undefined || data.description === null ? undefined : data.description,
        city: data.city ?? undefined,
        status: data.status ?? undefined,
      },
    });
  });
  return vehicle ? toVehicle(vehicle) : null;
}

export async function deleteVehicle(id: string, ownerId: string): Promise<boolean> {
  const result = await prisma.vehicle.deleteMany({ where: { id, ownerId } });
  return result.count > 0;
}

// ---------- Bookings ----------

export async function getBookingsForOwner(ownerId: string): Promise<Booking[]> {
  const bookings = await prisma.booking.findMany({
    where: { ownerId },
    orderBy: { pickupDateTime: "desc" },
    include: { vehicle: { select: { name: true, photoUrl: true } } },
  });
  return bookings.map((b) => ({
    id: b.id,
    ownerId: b.ownerId,
    vehicleId: b.vehicleId,
    vehicleName: b.vehicle.name,
    vehiclePhotoUrl: b.vehicle.photoUrl,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    pickupDateTime: b.pickupDateTime.toISOString(),
    returnDateTime: b.returnDateTime.toISOString(),
    quantity: b.quantity,
    totalAmount: b.totalAmount,
    status: b.status as BookingStatus,
    paymentStatus: b.paymentStatus as Booking["paymentStatus"],
    utrNumber: b.utrNumber,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function updateBookingStatus(
  id: string,
  ownerId: string,
  status: BookingStatus
): Promise<boolean> {
  const result = await prisma.booking.updateMany({ where: { id, ownerId }, data: { status } });
  const updated = result.count > 0;

  // Best-effort: reflect the change back into the customer's own booking record too
  // (a different app's table, rentoCustomer/customer_bookings, in this same database)
  // — otherwise a customer's "My Bookings" page would show "Upcoming" forever even
  // after the shop owner marks the rental Completed or Cancelled.
  if (updated) {
    try {
      await prisma.customerBooking.updateMany({
        where: { partnerBookingId: id },
        data: { status },
      });
    } catch (err) {
      console.error("Failed to sync booking status back to rentoCustomer:", err);
    }
  }

  return updated;
}
