import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { CopmAgentWorker } from "@/lib/orchestrator/worker";
import { listAgentRuns } from "@/lib/services/agent-run-service";
import { updateProject } from "@/lib/services/project-service";

export const GET = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
  const runs = await listAgentRuns(projectId);
  return jsonSuccess(runs);
});

export const POST = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const payload = (await request.json()) as { projectId?: string };
  const worker = new CopmAgentWorker();
  await worker.bootstrap();

  if (payload.projectId?.trim()) {
    const projectId = payload.projectId.trim();
    await updateProject(projectId, { autonomousAgentEnabled: true });
    await worker.triggerProject(projectId);
    return jsonSuccess({ triggered: true, mode: "PROJECT", projectId }, 202);
  }

  await worker.tick("MANUAL");
  return jsonSuccess({ triggered: true, mode: "TICK" }, 202);
});
