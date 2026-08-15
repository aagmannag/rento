-- After a customer books, they need a way to actually reach the shop (confirm pickup
-- time, ask directions, etc.) beyond the address already stored on this row. Adds the
-- shop owner's phone number, frozen at booking time the same way shop_name/shop_address
-- already are (see rentoCustomer's createCustomerBooking) rather than looked up live, so
-- a booking keeps showing the number the shop actually had when it was made.
--
-- Nullable with no default and no backfill: only ever populated going forward, so every
-- booking made before this migration correctly reads as "not available" rather than a
-- fabricated number.
ALTER TABLE "customer_bookings"
  ADD COLUMN "shop_phone" TEXT;
