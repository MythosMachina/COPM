-- CreateTable
CREATE TABLE "GitHubAdapterConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedApiToken" TEXT,
    "tokenHint" TEXT,
    "username" TEXT,
    "email" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "lastHealthMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubAdapterConfig_pkey" PRIMARY KEY ("id")
);
