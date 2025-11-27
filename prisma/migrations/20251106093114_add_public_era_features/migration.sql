-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IncidentStatus" ADD VALUE 'PENDING_VERIFICATION';
ALTER TYPE "IncidentStatus" ADD VALUE 'SPAM';

-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'FLOOD';

-- DropForeignKey
ALTER TABLE "incident_photos" DROP CONSTRAINT "incident_photos_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "incidents" DROP CONSTRAINT "incidents_createdById_fkey";

-- AlterTable
ALTER TABLE "incident_photos" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "isPublicReport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicSessionId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "lastReportAt" TIMESTAMP(3),
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_sessions_sessionToken_key" ON "public_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "public_sessions_sessionToken_idx" ON "public_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "public_sessions_ipAddress_idx" ON "public_sessions"("ipAddress");

-- CreateIndex
CREATE INDEX "public_sessions_expiresAt_idx" ON "public_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_publicSessionId_fkey" FOREIGN KEY ("publicSessionId") REFERENCES "public_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
