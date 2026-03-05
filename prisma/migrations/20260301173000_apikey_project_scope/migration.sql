ALTER TABLE "ApiKey"
ADD COLUMN "projectId" TEXT;

CREATE INDEX "ApiKey_projectId_idx" ON "ApiKey"("projectId");

ALTER TABLE "ApiKey"
ADD CONSTRAINT "ApiKey_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
