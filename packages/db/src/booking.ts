import type { Booking, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client";

type Queryable = Pick<PrismaClient, "$queryRaw"> | Prisma.TransactionClient;

/**
 * Every Upcoming booking for a vehicle — placed by ANY customer, in ANY browser or
 * session — ties up `quantity` units. Aggregating this in SQL (rather than filtering
 * whatever bookings happen to be loaded client-side) is what makes availability
 * consistent no matter who's looking or from where.
 *
 * Payment status refines this further, since bookings go through manual UPI
 * verification rather than confirming instantly:
 *   - Rejected payments never hold a unit (released immediately).
 *   - Submitted/Verified always hold a unit (real payment claimed or confirmed).
 *   - Pending (no UTR submitted yet) only holds a unit for 30 minutes — an abandoned
 *     checkout shouldn't tie up stock forever with nothing to show for it.
 *
 * Shared by portalPartner (owner's own stock view) and rentoCustomer (customer-facing
 * availability) so the "what counts as booked" rule can never drift between the two.
 */
export async function bookedQuantity(client: Queryable, vehicleId: string): Promise<number> {
  const rows = await client.$queryRaw<{ booked: bigint }[]>`
    SELECT COALESCE(SUM(quantity), 0) AS booked
    FROM bookings
    WHERE vehicle_id = ${vehicleId}::uuid AND status = 'Upcoming'
      AND (
        payment_status IN ('Submitted', 'Verified')
        OR (payment_status = 'Pending' AND created_at > now() - interval '30 minutes')
      )
  `;
  return Number(rows[0]?.booked ?? 0);
}

export interface CreateBookingForVehicleInput {
  vehicleId: string;
  ownerId: string;
  customerName: string;
  customerPhone: string;
  pickupDateTime: Date;
  returnDateTime: Date;
  quantity: number;
  totalAmount: number;
}

export type CreateBookingForVehicleResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" | "sold_out" };

/**
 * Atomically re-checks availability and inserts the booking, closing the race window
 * that existed when these were two separate, unlocked queries: two simultaneous
 * requests for a vehicle's last unit could otherwise both pass the check before either
 * insert landed, overselling it. `FOR UPDATE` locks the vehicle row for the duration of
 * this transaction, serializing concurrent bookings against the same vehicle, and the
 * availability check re-runs *inside* that lock, right before the insert.
 */
export async function createBookingForVehicle(
  input: CreateBookingForVehicleInput
): Promise<CreateBookingForVehicleResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; stock: number }[]>`
      SELECT id, stock FROM vehicles WHERE id = ${input.vehicleId}::uuid FOR UPDATE
    `;
    const vehicle = rows[0];
    if (!vehicle) return { ok: false, reason: "not_found" };

    const booked = await bookedQuantity(tx, input.vehicleId);
    if (vehicle.stock - booked < input.quantity) {
      return { ok: false, reason: "sold_out" };
    }

    const booking = await tx.booking.create({
      data: {
        ownerId: input.ownerId,
        vehicleId: input.vehicleId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        pickupDateTime: input.pickupDateTime,
        returnDateTime: input.returnDateTime,
        quantity: input.quantity,
        totalAmount: input.totalAmount,
      },
    });
    return { ok: true, booking };
  });
}
