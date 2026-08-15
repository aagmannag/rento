-- Purely additive: one index, no data/constraint changes. Needed by portalPartner's
-- getBookingsForOwner fix, which now queries customer_ratings by owner_id directly (in
-- parallel with the main bookings query, rather than only after learning which booking
-- ids are eligible) -- without this, that query is a full table scan.
CREATE INDEX "customer_ratings_owner_id_idx" ON "customer_ratings"("owner_id");
