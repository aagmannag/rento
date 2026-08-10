-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_owners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_name" TEXT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "engine_label" TEXT NOT NULL DEFAULT '',
    "photo_url" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_per_day" INTEGER NOT NULL,
    "price_per_hour" INTEGER NOT NULL,
    "security_deposit" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "fuel" TEXT NOT NULL DEFAULT 'Petrol',
    "transmission" TEXT NOT NULL DEFAULT 'Manual',
    "seats" INTEGER NOT NULL DEFAULT 2,
    "mileage" TEXT NOT NULL DEFAULT '',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "city" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "pickup_datetime" TIMESTAMPTZ(6) NOT NULL,
    "return_datetime" TIMESTAMPTZ(6) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "payment_status" TEXT NOT NULL DEFAULT 'Pending',
    "utr_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Rento User',
    "gender" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_bookings" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "vehicle_name" TEXT NOT NULL,
    "vehicle_image" TEXT,
    "vehicle_photo" TEXT,
    "city" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "shop_address" TEXT NOT NULL,
    "shop_latitude" DOUBLE PRECISION,
    "shop_longitude" DOUBLE PRECISION,
    "rental_mode" TEXT NOT NULL,
    "pickup_datetime" TIMESTAMPTZ(6) NOT NULL,
    "return_datetime" TIMESTAMPTZ(6) NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_per_day" INTEGER NOT NULL,
    "price_per_hour" INTEGER NOT NULL,
    "rental_cost" INTEGER NOT NULL,
    "security_deposit" INTEGER NOT NULL,
    "total_payable_online" INTEGER NOT NULL,
    "total_payable_at_shop" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "payment_status" TEXT NOT NULL DEFAULT 'Pending',
    "utr_number" TEXT,
    "payment_screenshot_url" TEXT,
    "payment_note" TEXT,
    "partner_booking_id" TEXT,
    "payment_submitted_at" TIMESTAMPTZ(6),
    "payment_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shop_owners_email_key" ON "shop_owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "shop_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "shop_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_bookings" ADD CONSTRAINT "customer_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

