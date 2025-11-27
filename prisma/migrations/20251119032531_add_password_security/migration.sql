-- CreateTable
CREATE TABLE "password_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldPasswordHash" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT NOT NULL,

    CONSTRAINT "password_changes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "password_changes" ADD CONSTRAINT "password_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
