-- Two-way ratings feature: customers rate the partner (shop) and the Rento platform
-- after a Completed+Verified booking; shop owners rate the customer back. See the
-- doc comments on PartnerRating/PlatformRating/CustomerRating in schema.prisma for the
-- full design (cached aggregates for the shop/customer, live aggregate for the
-- platform, static→dynamic display thresholds).

-- AlterTable: cached rating aggregate for shop_owners (drives the per-shop
-- static(4.5)→dynamic display switch once rating_count >= 5).
ALTER TABLE "shop_owners" ADD COLUMN "rating_sum" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shop_owners" ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: cached rating aggregate for users (customer's own received rating,
-- shown on their rentoCustomer profile — no static seed/threshold, see model doc).
ALTER TABLE "users" ADD COLUMN "rating_sum" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: the rentoCustomer User.id who made this booking, set at creation time
-- going forward. Nullable — pre-existing rows fall back to a phone-number lookup when
-- resolving who to credit a CustomerRating to (see portalPartner's submitCustomerRating).
ALTER TABLE "bookings" ADD COLUMN "user_id" UUID;

-- CreateTable
CREATE TABLE "partner_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_booking_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "partner_ratings_stars_check" CHECK ("stars" >= 1 AND "stars" <= 5)
);

-- CreateTable
CREATE TABLE "platform_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_booking_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_ratings_stars_check" CHECK ("stars" >= 1 AND "stars" <= 5)
);

-- CreateTable
CREATE TABLE "customer_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_booking_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_ratings_stars_check" CHECK ("stars" >= 1 AND "stars" <= 5)
);

-- CreateIndex: one rating per booking per type — the DB-level guarantee that makes
-- "already rated" race-proof instead of an app-level check.
CREATE UNIQUE INDEX "partner_ratings_customer_booking_id_key" ON "partner_ratings"("customer_booking_id");
CREATE UNIQUE INDEX "platform_ratings_customer_booking_id_key" ON "platform_ratings"("customer_booking_id");
CREATE UNIQUE INDEX "customer_ratings_partner_booking_id_key" ON "customer_ratings"("partner_booking_id");

-- CreateIndex: shop owners' own received-ratings view (fast-follow, not built yet).
CREATE INDEX "partner_ratings_owner_id_idx" ON "partner_ratings"("owner_id");
-- CreateIndex: rentoCustomer profile page reads a customer's own received ratings.
CREATE INDEX "customer_ratings_user_id_idx" ON "customer_ratings"("user_id");

-- AddForeignKey
ALTER TABLE "partner_ratings" ADD CONSTRAINT "partner_ratings_customer_booking_id_fkey" FOREIGN KEY ("customer_booking_id") REFERENCES "customer_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ratings" ADD CONSTRAINT "platform_ratings_customer_booking_id_fkey" FOREIGN KEY ("customer_booking_id") REFERENCES "customer_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ratings" ADD CONSTRAINT "customer_ratings_partner_booking_id_fkey" FOREIGN KEY ("partner_booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
