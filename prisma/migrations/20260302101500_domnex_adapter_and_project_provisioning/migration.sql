CREATE TYPE "ProvisionStatus" AS ENUM ('DISABLED', 'PENDING', 'RUNNING', 'READY', 'FAILED');

ALTER TABLE "Project"
ADD COLUMN "autoProvisionDomain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "provisionStatus" "ProvisionStatus" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN "provisionError" TEXT,
ADD COLUMN "fqdn" TEXT,
ADD COLUMN "domnexHostId" TEXT,
ADD COLUMN "provisionedAt" TIMESTAMP(3);

CREATE TABLE "DomNexAdapterConfig" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT NOT NULL,
  "encryptedApiToken" TEXT,
  "tokenHint" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "lastHealthStatus" TEXT,
  "lastHealthMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomNexAdapterConfig_pkey" PRIMARY KEY ("id")
);
