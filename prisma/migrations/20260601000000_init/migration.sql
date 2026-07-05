-- CreateEnum
CREATE TYPE "OrganiserStatus" AS ENUM ('APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EVENT_APPROVED', 'EVENT_REJECTED', 'NEW_REGISTRATION');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "cognitoSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrganiserStatus" NOT NULL DEFAULT 'APPROVED',
    "orgName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "abn" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "bio" TEXT,
    "logoUrl" TEXT,
    "logoPosition" TEXT DEFAULT '50% 50%',
    "coverImageUrl" TEXT,
    "coverPosition" TEXT DEFAULT '50% 50%',
    "photos" TEXT[],
    "legalName" TEXT,
    "insuranceDeclared" BOOLEAN NOT NULL DEFAULT false,
    "dob" TEXT,
    "stripeAccountId" TEXT,
    "stripeOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_basics" (
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,

    CONSTRAINT "event_basics_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_schedules" (
    "eventId" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "endDate" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "event_schedules_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_formats" (
    "eventId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "cap" INTEGER,
    "minAge" INTEGER NOT NULL DEFAULT 16,

    CONSTRAINT "event_formats_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "eventId" TEXT NOT NULL,
    "inclusions" TEXT,
    "extras" TEXT,
    "activations" TEXT,
    "refundPolicy" TEXT,
    "registrationType" TEXT NOT NULL DEFAULT 'startline',
    "feeStructure" TEXT NOT NULL DEFAULT 'athlete',
    "registrationUrl" TEXT,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_waves" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "closesAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_waves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_details" (
    "eventId" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "bagDrop" TEXT,
    "parking" TEXT,
    "accessibilityInfo" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "event_details_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_admin_reviews" (
    "eventId" TEXT NOT NULL,
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "event_admin_reviews_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "eventId" TEXT,
    "eventTitle" TEXT,
    "overallRating" INTEGER NOT NULL,
    "communicationRating" INTEGER,
    "organisationRating" INTEGER,
    "experienceRating" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "userId" TEXT,
    "athleteName" TEXT NOT NULL,
    "athleteEmail" TEXT NOT NULL,
    "category" TEXT,
    "waveLabel" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "feeStructure" TEXT NOT NULL DEFAULT 'athlete',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "cognitoSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "profilePicUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_subscribers" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_cognitoSub_key" ON "admins"("cognitoSub");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organisers_userId_key" ON "organisers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organisers_email_key" ON "organisers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organisers_stripeAccountId_key" ON "organisers"("stripeAccountId");

-- CreateIndex
CREATE INDEX "event_categories_eventId_idx" ON "event_categories"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_eventId_name_key" ON "event_categories"("eventId", "name");

-- CreateIndex
CREATE INDEX "event_waves_eventId_idx" ON "event_waves"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_waves_eventId_label_key" ON "event_waves"("eventId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_stripePaymentIntentId_key" ON "registrations"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "registrations_eventId_idx" ON "registrations"("eventId");

-- CreateIndex
CREATE INDEX "registrations_organiserId_idx" ON "registrations"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoSub_key" ON "users"("cognitoSub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_subscribers_email_key" ON "waitlist_subscribers"("email");

-- AddForeignKey
ALTER TABLE "organisers" ADD CONSTRAINT "organisers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_basics" ADD CONSTRAINT "event_basics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedules" ADD CONSTRAINT "event_schedules_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_formats" ADD CONSTRAINT "event_formats_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_formats"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_waves" ADD CONSTRAINT "event_waves_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_tickets"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admin_reviews" ADD CONSTRAINT "event_admin_reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admin_reviews" ADD CONSTRAINT "event_admin_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "organisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

