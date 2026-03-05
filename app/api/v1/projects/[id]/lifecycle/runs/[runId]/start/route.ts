import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { startLifecycleBuild } from "@/lib/services/lifecycle-service";

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string } }) => {
    await assertCodexApiKey(request, { projectId: params.id });
    const run = await startLifecycleBuild(params.id, params.runId);
    return jsonSuccess(run);
  },
);
