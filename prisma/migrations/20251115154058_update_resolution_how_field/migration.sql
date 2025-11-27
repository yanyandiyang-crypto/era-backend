/*
  Warnings:

  - You are about to drop the column `outcome` on the `incident_resolutions` table. All the data in the column will be lost.
  - Changed the type of `how` on the `incident_resolutions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "incident_resolutions" DROP COLUMN "outcome",
DROP COLUMN "how",
ADD COLUMN     "how" "ResolutionOutcome" NOT NULL;
