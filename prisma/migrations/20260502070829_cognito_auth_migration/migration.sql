-- CreateEnum
CREATE TYPE "OrganiserStatus" AS ENUM ('PENDING_EMAIL', 'PENDING_PROFILE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organiser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cognitoSub" TEXT NOT NULL,
    "status" "OrganiserStatus" NOT NULL DEFAULT 'PENDING_PROFILE',
    "orgName" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "abn" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "bio" TEXT,
    "logoUrl" TEXT,
    "insuranceUrl" TEXT,
    "pastEventsUrl" TEXT,
    "certifications" TEXT,
    "emailOnApprove" BOOLEAN NOT NULL DEFAULT true,
    "emailOnReject" BOOLEAN NOT NULL DEFAULT true,
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "eventDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "cap" INTEGER,
    "minAge" INTEGER NOT NULL DEFAULT 16,
    "waves" JSONB NOT NULL,
    "inclusions" TEXT,
    "extras" TEXT,
    "refundPolicy" TEXT,
    "coverImageUrl" TEXT,
    "registrationUrl" TEXT,
    "bagDrop" TEXT,
    "parking" TEXT,
    "accessibilityInfo" TEXT,
    "additionalNotes" TEXT,
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
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

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organiser_email_key" ON "Organiser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organiser_cognitoSub_key" ON "Organiser"("cognitoSub");

-- AddForeignKey
ALTER TABLE "Organiser" ADD CONSTRAINT "Organiser_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
