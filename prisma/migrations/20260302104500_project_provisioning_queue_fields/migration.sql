ALTER TABLE "Project"
ADD COLUMN "provisionUpstreamUrl" TEXT,
ADD COLUMN "provisionInsecureTls" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "provisionHaEnabled" BOOLEAN NOT NULL DEFAULT false;
