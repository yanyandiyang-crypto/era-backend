-- CreateEnum
CREATE TYPE "ResolutionOutcome" AS ENUM ('BROUGHT_TO_POLICE_STATION', 'BROUGHT_TO_HOSPITAL', 'RESPONDED_BY_FIREFIGHTER', 'BROUGHT_TO_BARANGAY', 'RESPONDED_BY_POLICE', 'COMMON_RESOLVED', 'OTHER');

-- AlterEnum
ALTER TYPE "IncidentStatus" ADD VALUE 'PENDING_RESOLVE';

-- CreateTable
CREATE TABLE "incident_resolutions" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "where" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "how" TEXT NOT NULL,
    "outcome" "ResolutionOutcome" NOT NULL,
    "notes" TEXT,
    "submittedByPersonnelId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByAdminId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "adminNotes" TEXT,

    CONSTRAINT "incident_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_resolutions_incidentId_key" ON "incident_resolutions"("incidentId");

-- AddForeignKey
ALTER TABLE "incident_resolutions" ADD CONSTRAINT "incident_resolutions_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_resolutions" ADD CONSTRAINT "incident_resolutions_submittedByPersonnelId_fkey" FOREIGN KEY ("submittedByPersonnelId") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_resolutions" ADD CONSTRAINT "incident_resolutions_confirmedByAdminId_fkey" FOREIGN KEY ("confirmedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
