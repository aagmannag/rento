import { prisma } from "@rento/db";
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

// Prisma returns DateTime columns as real `Date` objects; every app-facing type in
// ./types.ts declares `createdAt: string` (an ISO string, same as what these endpoints
// have always sent over the wire as JSON). These mappers do that conversion once,
// rather than at every call site.

function toAdmin<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function toOwner<T extends { createdAt: Date }>(row: T): Omit<T, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// ---------- Admin users ----------

export async function adminCount(): Promise<number> {
  return prisma.adminUser.count();
}

export async function createFirstAdmin(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AdminUser> {
  // Guard against a race between the "does an admin exist" check and this insert —
  // the setup screen should only ever be usable once.
  const existing = await adminCount();
  if (existing > 0) {
    throw new Error("An admin account already exists.");
  }

  const admin = await prisma.adminUser.create({
    data: { name: data.name, email: data.email.toLowerCase(), passwordHash: data.passwordHash },
  });
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

export async function findAdminByEmailWithHash(
  email: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  return admin ? toAdmin(admin) : null;
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) return null;
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

export async function getAdminByIdWithHash(
  id: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  return admin ? toAdmin(admin) : null;
}

export async function updateAdminPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.adminUser.update({ where: { id }, data: { passwordHash } });
}

export async function updateAdminName(id: string, name: string): Promise<AdminUser> {
  const admin = await prisma.adminUser.update({ where: { id }, data: { name } });
  const { passwordHash: _drop, ...rest } = toAdmin(admin);
  return rest;
}

// ---------- Shop owner review ----------

export async function listShopOwners(status?: OwnerApprovalStatus): Promise<ShopOwner[]> {
  const owners = await prisma.shopOwner.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return owners.map(toOwner);
}

export async function getShopOwnerDetail(id: string): Promise<ShopOwnerDetail | null> {
  const ownerRow = await prisma.shopOwner.findUnique({ where: { id } });
  if (!ownerRow) return null;
  const owner = toOwner(ownerRow);

  const [vehicles, totalBookings, completedTotals] = await Promise.all([
    prisma.vehicle.findMany({
      where: { ownerId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, name: true, brand: true, photoUrl: true, pricePerDay: true, stock: true, city: true, status: true },
    }),
    prisma.booking.count({ where: { ownerId: id } }),
    prisma.booking.aggregate({
      where: { ownerId: id, status: "Completed" },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    ...owner,
    vehicles: vehicles.map((v) => ({
      id: v.id,
      category: v.category as Category,
      name: v.name,
      brand: v.brand,
      photoUrl: resolvePhotoUrl(v.photoUrl),
      pricePerDay: v.pricePerDay,
      stock: v.stock,
      city: v.city,
      status: v.status as VehicleStatus,
    })),
    totalBookings,
    totalEarnings: completedTotals._sum.totalAmount ?? 0,
  };
}

async function setOwnerStatus(
  id: string,
  fromStatuses: OwnerApprovalStatus[],
  toStatus: OwnerApprovalStatus,
  rejectionReason: string | null = null
): Promise<ShopOwner | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopOwner.findUnique({ where: { id } });
    if (!existing || !fromStatuses.includes(existing.status)) return null;
    return tx.shopOwner.update({
      where: { id },
      data: { status: toStatus, rejectionReason },
    });
  });
  return updated ? toOwner(updated) : null;
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
 *  real map and marks the exact point, which is what customers actually see. Passes
 *  latitude/longitude straight through (not merged with existing values) so passing
 *  null actually clears a previously-set pin. */
export async function updateOwnerLocation(
  id: string,
  latitude: number | null,
  longitude: number | null
): Promise<ShopOwner | null> {
  try {
    const owner = await prisma.shopOwner.update({ where: { id }, data: { latitude, longitude } });
    return toOwner(owner);
  } catch {
    return null;
  }
}

export async function reinstateOwner(id: string): Promise<ShopOwner | null> {
  return setOwnerStatus(id, ["Suspended"], "Approved");
}

// ---------- Platform stats ----------

export async function getPlatformStats(): Promise<PlatformStats> {
  const [ownerStats, vehicleStats, totalBookings] = await Promise.all([
    prisma.shopOwner.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.count(),
  ]);

  const ownersByStatus: Record<string, number> = {};
  for (const row of ownerStats) ownersByStatus[row.status] = row._count._all;

  const vehiclesByStatus: Record<string, number> = {};
  for (const row of vehicleStats) vehiclesByStatus[row.status] = row._count._all;

  return {
    totalOwners: Object.values(ownersByStatus).reduce((a, b) => a + b, 0),
    pendingOwners: ownersByStatus["Pending"] ?? 0,
    approvedOwners: ownersByStatus["Approved"] ?? 0,
    rejectedOwners: ownersByStatus["Rejected"] ?? 0,
    suspendedOwners: ownersByStatus["Suspended"] ?? 0,
    totalVehicles: Object.values(vehiclesByStatus).reduce((a, b) => a + b, 0),
    activeVehicles: vehiclesByStatus["Active"] ?? 0,
    totalBookings,
  };
}

// ---------- Vehicle moderation ----------

export async function listAllVehicles(): Promise<Vehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { ownerName: true, shopName: true, status: true } } },
  });
  return vehicles.map((v) => ({
    id: v.id,
    ownerId: v.ownerId,
    ownerName: v.owner.ownerName,
    shopName: v.owner.shopName,
    ownerStatus: v.owner.status as OwnerApprovalStatus,
    category: v.category as Category,
    name: v.name,
    brand: v.brand,
    photoUrl: resolvePhotoUrl(v.photoUrl),
    pricePerDay: v.pricePerDay,
    stock: v.stock,
    city: v.city,
    status: v.status as VehicleStatus,
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function setVehicleStatus(id: string, status: VehicleStatus): Promise<boolean> {
  const result = await prisma.vehicle.updateMany({ where: { id }, data: { status } });
  return result.count > 0;
}
