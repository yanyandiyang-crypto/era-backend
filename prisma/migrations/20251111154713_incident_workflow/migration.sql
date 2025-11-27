-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IncidentStatus" ADD VALUE 'VERIFIED';
ALTER TYPE "IncidentStatus" ADD VALUE 'RESPONDING';
ALTER TYPE "IncidentStatus" ADD VALUE 'ARRIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PersonnelStatus" ADD VALUE 'RESPONDING';
ALTER TYPE "PersonnelStatus" ADD VALUE 'ON_SCENE';

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "primaryResponderId" TEXT,
ADD COLUMN     "resolutionNotes" TEXT,
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "respondingAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "incident_responders" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "incident_responders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timeline" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "personnelId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "incident_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_responders_incidentId_idx" ON "incident_responders"("incidentId");

-- CreateIndex
CREATE INDEX "incident_responders_personnelId_idx" ON "incident_responders"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_responders_incidentId_personnelId_key" ON "incident_responders"("incidentId", "personnelId");

-- CreateIndex
CREATE INDEX "incident_timeline_incidentId_timestamp_idx" ON "incident_timeline"("incidentId", "timestamp");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_primaryResponderId_fkey" FOREIGN KEY ("primaryResponderId") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_responders" ADD CONSTRAINT "incident_responders_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_responders" ADD CONSTRAINT "incident_responders_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
