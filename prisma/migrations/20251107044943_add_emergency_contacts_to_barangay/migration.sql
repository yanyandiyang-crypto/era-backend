-- CreateEnum
CREATE TYPE "EmergencyContactType" AS ENUM ('EMERGENCY', 'BARANGAY_HALL', 'POLICE', 'FIRE', 'MEDICAL', 'OTHER');

-- AlterTable
ALTER TABLE "barangays" ADD COLUMN     "landmarks" TEXT,
ADD COLUMN     "operatingHours" TEXT;

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "barangayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" "EmergencyContactType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_barangayId_fkey" FOREIGN KEY ("barangayId") REFERENCES "barangays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
