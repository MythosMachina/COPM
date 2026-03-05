-- Create sequences for human-readable visual IDs
CREATE SEQUENCE "project_visual_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE SEQUENCE "task_visual_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Add visual ID columns
ALTER TABLE "Project" ADD COLUMN "visualId" TEXT;
ALTER TABLE "Task" ADD COLUMN "visualId" TEXT;

-- Backfill existing projects/tasks
UPDATE "Project"
SET "visualId" = 'PRJ-' || lpad(nextval('project_visual_id_seq')::text, 4, '0')
WHERE "visualId" IS NULL;

UPDATE "Task"
SET "visualId" = 'TSK-' || lpad(nextval('task_visual_id_seq')::text, 5, '0')
WHERE "visualId" IS NULL;

-- Enforce defaults and constraints for future inserts
ALTER TABLE "Project"
  ALTER COLUMN "visualId" SET DEFAULT ('PRJ-' || lpad(nextval('project_visual_id_seq')::text, 4, '0')),
  ALTER COLUMN "visualId" SET NOT NULL;

ALTER TABLE "Task"
  ALTER COLUMN "visualId" SET DEFAULT ('TSK-' || lpad(nextval('task_visual_id_seq')::text, 5, '0')),
  ALTER COLUMN "visualId" SET NOT NULL;

CREATE UNIQUE INDEX "Project_visualId_key" ON "Project"("visualId");
CREATE UNIQUE INDEX "Task_visualId_key" ON "Task"("visualId");

