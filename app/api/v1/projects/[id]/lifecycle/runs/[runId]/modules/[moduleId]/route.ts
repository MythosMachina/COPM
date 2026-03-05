import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { updateLifecycleModuleStatus } from "@/lib/services/lifecycle-service";
import { updateLifecycleModuleSchema } from "@/lib/validation/lifecycle-schemas";

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string; moduleId: string } }) => {
    await assertCodexApiKey(request, { projectId: params.id });
    const payload = updateLifecycleModuleSchema.parse(await request.json());
    const run = await updateLifecycleModuleStatus(params.id, params.runId, params.moduleId, payload);
    return jsonSuccess(run);
  },
);
