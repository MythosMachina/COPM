-- CreateEnum
CREATE TYPE "LifecycleRunMode" AS ENUM ('STEP', 'BATCH');

-- CreateEnum
CREATE TYPE "LifecycleRunStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'BLOCKED', 'VERIFIED', 'DEPLOYED', 'FAILED', 'CANCELED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "LifecycleClassification" AS ENUM ('BIRTH', 'CHANGE', 'FIX', 'ITERATE', 'TEARDOWN');

-- CreateEnum
CREATE TYPE "LifecycleModuleType" AS ENUM ('TECHSTACK', 'FEATURE', 'CHECK', 'DOMAIN', 'DEPLOY', 'CHANGE', 'FIX', 'ITERATE', 'TEARDOWN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LifecycleModuleStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ModuleCompletionPolicy" AS ENUM ('PAUSE_ALWAYS', 'PAUSE_ON_RISK', 'CONTINUE_AUTOMATIC');

-- CreateEnum
CREATE TYPE "LifecycleRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "LifecycleRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "LifecycleRunMode" NOT NULL DEFAULT 'STEP',
    "status" "LifecycleRunStatus" NOT NULL DEFAULT 'DRAFT',
    "classification" "LifecycleClassification" NOT NULL DEFAULT 'BIRTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LifecycleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleModule" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "moduleOrder" INTEGER NOT NULL,
    "moduleType" "LifecycleModuleType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "config" JSONB,
    "expectedState" TEXT NOT NULL,
    "actualState" TEXT,
    "gateRequired" BOOLEAN NOT NULL DEFAULT false,
    "completionPolicy" "ModuleCompletionPolicy" NOT NULL DEFAULT 'PAUSE_ON_RISK',
    "riskLevel" "LifecycleRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "LifecycleModuleStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LifecycleModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleTransition" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fromStatus" "LifecycleRunStatus" NOT NULL,
    "toStatus" "LifecycleRunStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleEvidence" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "moduleId" TEXT,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifecycleRun_projectId_idx" ON "LifecycleRun"("projectId");

-- CreateIndex
CREATE INDEX "LifecycleRun_status_idx" ON "LifecycleRun"("status");

-- CreateIndex
CREATE INDEX "LifecycleRun_createdAt_idx" ON "LifecycleRun"("createdAt");

-- CreateIndex
CREATE INDEX "LifecycleModule_runId_idx" ON "LifecycleModule"("runId");

-- CreateIndex
CREATE INDEX "LifecycleModule_status_idx" ON "LifecycleModule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleModule_runId_moduleOrder_key" ON "LifecycleModule"("runId", "moduleOrder");

-- CreateIndex
CREATE INDEX "LifecycleTransition_runId_idx" ON "LifecycleTransition"("runId");

-- CreateIndex
CREATE INDEX "LifecycleTransition_createdAt_idx" ON "LifecycleTransition"("createdAt");

-- CreateIndex
CREATE INDEX "LifecycleEvidence_runId_idx" ON "LifecycleEvidence"("runId");

-- CreateIndex
CREATE INDEX "LifecycleEvidence_moduleId_idx" ON "LifecycleEvidence"("moduleId");

-- CreateIndex
CREATE INDEX "LifecycleEvidence_createdAt_idx" ON "LifecycleEvidence"("createdAt");

-- AddForeignKey
ALTER TABLE "LifecycleRun" ADD CONSTRAINT "LifecycleRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleModule" ADD CONSTRAINT "LifecycleModule_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleTransition" ADD CONSTRAINT "LifecycleTransition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleEvidence" ADD CONSTRAINT "LifecycleEvidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleEvidence" ADD CONSTRAINT "LifecycleEvidence_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LifecycleModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
