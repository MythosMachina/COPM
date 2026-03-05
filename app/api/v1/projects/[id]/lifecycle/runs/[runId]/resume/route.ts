import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { resumeLifecycleRun } from "@/lib/services/lifecycle-service";
import { lifecycleRunResumeSchema } from "@/lib/validation/lifecycle-schemas";

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string } }) => {
    await assertCodexApiKey(request, { projectId: params.id });
    const payload = lifecycleRunResumeSchema.parse(await request.json());
    const run = await resumeLifecycleRun(params.id, params.runId, payload);
    return jsonSuccess(run);
  },
);
