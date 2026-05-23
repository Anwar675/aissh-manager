-- CreateEnum
CREATE TYPE "AutoStopTargetType" AS ENUM ('SSH_REMOTE', 'ALL_ACTIVE');

-- CreateEnum
CREATE TYPE "AutoStopStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "AutoStop" (
    "id" TEXT NOT NULL,
    "sshRemoteId" TEXT,
    "targetType" "AutoStopTargetType" NOT NULL DEFAULT 'SSH_REMOTE',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AutoStopStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoStop_status_scheduledAt_idx" ON "AutoStop"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AutoStop_sshRemoteId_status_idx" ON "AutoStop"("sshRemoteId", "status");

-- AddForeignKey
ALTER TABLE "AutoStop" ADD CONSTRAINT "AutoStop_sshRemoteId_fkey" FOREIGN KEY ("sshRemoteId") REFERENCES "SSHRemote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
