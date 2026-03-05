import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { updateLifecycleModuleDefinition, updateLifecycleModuleStatus } from "@/lib/services/lifecycle-service";
import {
  updateLifecycleModuleDefinitionSchema,
  updateLifecycleModuleSchema,
} from "@/lib/validation/lifecycle-schemas";

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string; moduleId: string } }) => {
    await requireAdminSession();
    const json = await request.json();
    const statusPayload = updateLifecycleModuleSchema.safeParse(json);
    const run = statusPayload.success
      ? await updateLifecycleModuleStatus(params.id, params.runId, params.moduleId, statusPayload.data)
      : await updateLifecycleModuleDefinition(
          params.id,
          params.runId,
          params.moduleId,
          updateLifecycleModuleDefinitionSchema.parse(json),
        );
    return jsonSuccess(run);
  },
);
