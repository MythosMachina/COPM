import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { CopmAgentWorker } from "@/lib/orchestrator/worker";
import { updateProject } from "@/lib/services/project-service";

export const POST = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  await updateProject(params.id, { autonomousAgentEnabled: true });

  const worker = new CopmAgentWorker();
  await worker.bootstrap();
  await worker.triggerProject(params.id);

  return jsonSuccess({ triggered: true, projectId: params.id }, 202);
});
