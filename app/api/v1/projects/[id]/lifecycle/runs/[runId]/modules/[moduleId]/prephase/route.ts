import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { upsertLifecycleModulePrephaseReview } from "@/lib/services/lifecycle-service";
import { upsertLifecycleModulePrephaseReviewSchema } from "@/lib/validation/lifecycle-schemas";

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string; moduleId: string } }) => {
    await assertCodexApiKey(request, { projectId: params.id });
    const payload = upsertLifecycleModulePrephaseReviewSchema.parse(await request.json());
    const run = await upsertLifecycleModulePrephaseReview(params.id, params.runId, params.moduleId, payload);
    return jsonSuccess(run);
  },
);
