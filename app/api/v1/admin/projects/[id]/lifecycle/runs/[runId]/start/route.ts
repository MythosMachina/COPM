import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { startLifecycleBuild } from "@/lib/services/lifecycle-service";

export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string; runId: string } }) => {
    await requireAdminSession();
    const run = await startLifecycleBuild(params.id, params.runId);
    return jsonSuccess(run);
  },
);
