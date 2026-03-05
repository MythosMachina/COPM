import { jsonSuccess } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { listTasksByProject } from "@/lib/services/task-service";

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const tasks = await listTasksByProject(params.id);
  return jsonSuccess(tasks);
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
});

export const DELETE = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
});
