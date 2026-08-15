-- Adds a terminal "Expired" member to PaymentStatus for Pending bookings whose 5-minute
-- payment hold (see @rento/db's PENDING_HOLD_MINUTES) elapses with no UTR submitted.
-- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction as long as the new value
-- isn't used by the same transaction, which holds here — this migration only adds it.
ALTER TYPE "PaymentStatus" ADD VALUE 'Expired';
