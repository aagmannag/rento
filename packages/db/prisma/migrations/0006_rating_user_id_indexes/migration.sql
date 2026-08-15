-- Purely additive: two indexes, no data/constraint changes. Added alongside the fix to
-- rentoCustomer's getBookingsForUser/getBookingForUser that now queries partner_ratings
-- and platform_ratings directly by user_id (in parallel with the main booking query,
-- rather than only after learning which booking ids are eligible) — without these,
-- that query is a full table scan. Cheap at today's data volume, but the query pattern
-- is now a permanent part of every /api/bookings and confirmation-page request, so it
-- should be indexed correctly from the start rather than waiting for it to matter.
CREATE INDEX "partner_ratings_user_id_idx" ON "partner_ratings"("user_id");
CREATE INDEX "platform_ratings_user_id_idx" ON "platform_ratings"("user_id");
