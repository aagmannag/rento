-- Convert free-text status columns to real Postgres enums, without losing data.
-- Prisma's naive diff for this change emits DROP COLUMN + ADD COLUMN, which would
-- destroy every existing row's status. This hand-written version instead casts the
-- existing values in place via `USING col::"Enum"`, safe because every live value
-- (verified against the DB before writing this migration) is already one of the
-- enum's members.

-- CreateEnum
CREATE TYPE "OwnerApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Suspended');
CREATE TYPE "VehicleStatus" AS ENUM ('Active', 'Inactive');
CREATE TYPE "BookingStatus" AS ENUM ('Upcoming', 'Completed', 'Cancelled');
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Submitted', 'Verified', 'Rejected');

-- AlterTable: shop_owners.status
ALTER TABLE "shop_owners" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shop_owners" ALTER COLUMN "status" TYPE "OwnerApprovalStatus" USING "status"::"OwnerApprovalStatus";
ALTER TABLE "shop_owners" ALTER COLUMN "status" SET DEFAULT 'Pending';

-- AlterTable: vehicles.status
ALTER TABLE "vehicles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "vehicles" ALTER COLUMN "status" TYPE "VehicleStatus" USING "status"::"VehicleStatus";
ALTER TABLE "vehicles" ALTER COLUMN "status" SET DEFAULT 'Active';

-- AlterTable: bookings.status, bookings.payment_status
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus" USING "status"::"BookingStatus";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'Upcoming';
ALTER TABLE "bookings" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "payment_status" TYPE "PaymentStatus" USING "payment_status"::"PaymentStatus";
ALTER TABLE "bookings" ALTER COLUMN "payment_status" SET DEFAULT 'Pending';

-- AlterTable: customer_bookings.status, customer_bookings.payment_status
ALTER TABLE "customer_bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "customer_bookings" ALTER COLUMN "status" TYPE "BookingStatus" USING "status"::"BookingStatus";
ALTER TABLE "customer_bookings" ALTER COLUMN "status" SET DEFAULT 'Upcoming';
ALTER TABLE "customer_bookings" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "customer_bookings" ALTER COLUMN "payment_status" TYPE "PaymentStatus" USING "payment_status"::"PaymentStatus";
ALTER TABLE "customer_bookings" ALTER COLUMN "payment_status" SET DEFAULT 'Pending';

-- Bonus hardening (approved as part of the race-condition fix): makes the UTR-reuse
-- check race-proof at the DB level, not just via the app's SELECT-then-UPDATE. Only
-- applies to Submitted/Verified rows, matching the app's existing dedupe logic exactly
-- (a Rejected booking's UTR is free to reuse, same as today).
CREATE UNIQUE INDEX "customer_bookings_utr_number_active_key"
  ON "customer_bookings" ("utr_number")
  WHERE "payment_status" IN ('Submitted', 'Verified');
