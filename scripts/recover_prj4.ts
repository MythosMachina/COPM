import { prisma } from "@/lib/prisma";
import { startLifecycleBuild } from "@/lib/services/lifecycle-service";
import { CopmAgentWorker } from "@/lib/orchestrator/worker";

const visualId = "PRJ-0004";

async function main() {
  const project = await prisma.project.findFirst({ where: { visualId }, select: { id: true } });
  if (!project) {
    throw new Error(`Project ${visualId} not found`);
  }

  const run = await prisma.lifecycleRun.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (!run) {
    throw new Error(`No lifecycle run for ${visualId}`);
  }

  if (run.status === "DRAFT") {
    await startLifecycleBuild(project.id, run.id);
    console.log(`[recover] lifecycle run started: ${run.id}`);
  } else {
    console.log(`[recover] lifecycle run already ${run.status}: ${run.id}`);
  }

  const worker = new CopmAgentWorker();
  await worker.bootstrap();

  await prisma.project.update({ where: { id: project.id }, data: { autonomousAgentEnabled: true } });
  await worker.triggerProject(project.id);
  await prisma.project.update({ where: { id: project.id }, data: { autonomousAgentEnabled: false } });

  console.log("[recover] one-shot trigger submitted and opt-in reverted to false");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
