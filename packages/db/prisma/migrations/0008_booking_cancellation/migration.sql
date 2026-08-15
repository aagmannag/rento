-- Cancellation bookkeeping for customer_bookings, backing rentoCustomer's self-service
-- cancel flow (POST /api/bookings/[id]/cancel).
--
-- The refund a cancellation earns is a function of how long before pickup it happened
-- (see rentoCustomer's lib/cancellationPolicy.ts: 6h+ = 100%, 3-6h = 80%, 1-3h = 50%,
-- under 1h = 0%). That makes it un-recomputable after the fact — once the moment has
-- passed there is no "now" left to measure from — so the quote is frozen onto the row
-- at cancel time, alongside who cancelled and when.
--
-- All four columns are nullable with no default and no backfill: they are only ever
-- written on the transition into Cancelled, so "null" correctly reads as "this booking
-- was never cancelled" for every existing row, including bookings cancelled before
-- this migration (whose refunds were settled manually by support).
ALTER TABLE "customer_bookings"
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_by" TEXT,
  ADD COLUMN "refund_percent" INTEGER,
  ADD COLUMN "refund_amount" INTEGER;
