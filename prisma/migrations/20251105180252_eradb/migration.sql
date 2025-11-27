/*
  Warnings:

  - You are about to drop the column `changes` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entity` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - Added the required column `resourceType` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filepath` to the `incident_photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `incident_photos` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropIndex
DROP INDEX "audit_logs_createdAt_idx";

-- DropIndex
DROP INDEX "audit_logs_entity_entityId_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "changes",
DROP COLUMN "createdAt",
DROP COLUMN "entity",
DROP COLUMN "entityId",
ADD COLUMN     "details" JSONB,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceType" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "incident_photos" ADD COLUMN     "filepath" TEXT NOT NULL,
ADD COLUMN     "uploadedById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "incident_updates" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "incident_photos_uploadedById_idx" ON "incident_photos"("uploadedById");

-- CreateIndex
CREATE INDEX "incident_updates_userId_idx" ON "incident_updates"("userId");

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
