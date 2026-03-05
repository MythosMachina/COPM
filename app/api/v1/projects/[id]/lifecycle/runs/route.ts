import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { createLifecycleRun, listLifecycleRunsByProject } from "@/lib/services/lifecycle-service";
import { createLifecycleRunSchema } from "@/lib/validation/lifecycle-schemas";

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const runs = await listLifecycleRunsByProject(params.id);
  return jsonSuccess(runs);
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const payload = createLifecycleRunSchema.parse(await request.json());
  const result = await createLifecycleRun(params.id, payload);
  return jsonSuccess(result, 201);
});
