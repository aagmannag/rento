-- Replaces the plain user_id index with a composite (user_id, created_at) index.
-- getBookingsForUser filters WHERE user_id = $1 ORDER BY created_at DESC — this serves
-- both the filter and the sort in one index. Leftmost-prefix rule means any query
-- filtering on user_id alone (e.g. getBookingRowForUser's id+userId lookup, though that
-- one is already served by the primary key) still uses this index just as well as the
-- single-column one it replaces, so nothing is lost.
DROP INDEX "customer_bookings_user_id_idx";
CREATE INDEX "customer_bookings_user_id_created_at_idx" ON "customer_bookings"("user_id", "created_at");
