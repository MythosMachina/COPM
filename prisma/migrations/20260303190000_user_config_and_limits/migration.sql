ALTER TABLE "User"
ADD COLUMN "projectLimit" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "githubEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "githubEncryptedApiToken" TEXT,
ADD COLUMN "githubTokenHint" TEXT,
ADD COLUMN "githubUsername" TEXT,
ADD COLUMN "githubEmail" TEXT,
ADD COLUMN "githubLastCheckedAt" TIMESTAMP(3),
ADD COLUMN "githubLastHealthStatus" TEXT,
ADD COLUMN "githubLastHealthMessage" TEXT;

ALTER TABLE "Project"
ADD COLUMN "createdByUserId" TEXT;

WITH preferred_owner AS (
  SELECT "id"
  FROM "User"
  ORDER BY CASE WHEN "role" = 'ADMIN' THEN 0 ELSE 1 END, "createdAt" ASC
  LIMIT 1
)
UPDATE "Project"
SET "createdByUserId" = (SELECT "id" FROM preferred_owner)
WHERE "createdByUserId" IS NULL;

ALTER TABLE "Project"
ALTER COLUMN "createdByUserId" SET NOT NULL;

CREATE INDEX "Project_createdByUserId_idx" ON "Project"("createdByUserId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserDomNexDomainAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDomNexDomainAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDomNexDomainAccess_userId_domain_key" ON "UserDomNexDomainAccess"("userId", "domain");
CREATE INDEX "UserDomNexDomainAccess_domain_idx" ON "UserDomNexDomainAccess"("domain");

ALTER TABLE "UserDomNexDomainAccess"
ADD CONSTRAINT "UserDomNexDomainAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
