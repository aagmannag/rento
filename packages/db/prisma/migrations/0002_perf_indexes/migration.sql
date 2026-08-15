-- Purely additive: 7 indexes, no data/constraint changes. CREATE INDEX CONCURRENTLY
-- isn't used here because Prisma migrations run inside a transaction and CONCURRENTLY
-- cannot run in one — acceptable since these tables are small; if this ever runs
-- against a large production table, run the CONCURRENTLY form manually outside a
-- migration instead.

-- Matches the exact WHERE clause of the booked-quantity aggregate (@rento/db's
-- bookedQuantity / listActivePartnerVehiclesWithAvailability) — the single hottest
-- query in the app, run on every vehicle-availability check and booking attempt.
CREATE INDEX "bookings_vehicle_id_status_payment_status_idx" ON "bookings"("vehicle_id", "status", "payment_status");

-- Postgres does not automatically index foreign key columns.
CREATE INDEX "bookings_owner_id_idx" ON "bookings"("owner_id");
CREATE INDEX "vehicles_owner_id_idx" ON "vehicles"("owner_id");

-- Every customer-facing listing query filters WHERE status = 'Active' / 'Approved'.
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");
CREATE INDEX "shop_owners_status_idx" ON "shop_owners"("status");

-- customer_bookings.user_id/partner_booking_id are plain columns, not declared foreign
-- keys (see the model's doc comment on why), so they need explicit indexes too.
CREATE INDEX "customer_bookings_user_id_idx" ON "customer_bookings"("user_id");
CREATE INDEX "customer_bookings_partner_booking_id_idx" ON "customer_bookings"("partner_booking_id");

-- listPendingPayments (portalAdmin) filters WHERE payment_status = 'Submitted'.
CREATE INDEX "customer_bookings_payment_status_idx" ON "customer_bookings"("payment_status");
