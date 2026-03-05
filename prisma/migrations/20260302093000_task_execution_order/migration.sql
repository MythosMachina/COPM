ALTER TABLE "Task"
ADD COLUMN "executionOrder" INTEGER NOT NULL DEFAULT 1000;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY
        CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
        "createdAt" ASC,
        "visualId" ASC
    ) AS rn
  FROM "Task"
)
UPDATE "Task" t
SET "executionOrder" = ranked.rn
FROM ranked
WHERE t.id = ranked.id;

CREATE INDEX "Task_projectId_executionOrder_idx"
ON "Task"("projectId", "executionOrder");
