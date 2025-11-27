-- CreateTable
CREATE TABLE "incident_notification_acks" (
    "id" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incidentId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,

    CONSTRAINT "incident_notification_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_notification_acks_incidentId_idx" ON "incident_notification_acks"("incidentId");

-- CreateIndex
CREATE INDEX "incident_notification_acks_personnelId_idx" ON "incident_notification_acks"("personnelId");

-- CreateIndex
CREATE INDEX "incident_notification_acks_acknowledgedAt_idx" ON "incident_notification_acks"("acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "incident_notification_acks_incidentId_personnelId_key" ON "incident_notification_acks"("incidentId", "personnelId");

-- AddForeignKey
ALTER TABLE "incident_notification_acks" ADD CONSTRAINT "incident_notification_acks_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notification_acks" ADD CONSTRAINT "incident_notification_acks_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
