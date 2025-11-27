/*
  Warnings:

  - The values [ACTIVE] on the enum `PersonnelStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PersonnelStatus_new" AS ENUM ('AVAILABLE', 'ON_DUTY', 'OFF_DUTY', 'ON_BREAK', 'INACTIVE', 'SUSPENDED');
ALTER TABLE "personnel" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "personnel" ALTER COLUMN "status" TYPE "PersonnelStatus_new" USING ("status"::text::"PersonnelStatus_new");
ALTER TYPE "PersonnelStatus" RENAME TO "PersonnelStatus_old";
ALTER TYPE "PersonnelStatus_new" RENAME TO "PersonnelStatus";
DROP TYPE "PersonnelStatus_old";
ALTER TABLE "personnel" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "personnel" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
