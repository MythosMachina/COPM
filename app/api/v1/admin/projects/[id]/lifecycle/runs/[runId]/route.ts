import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { deleteLifecycleRun, getLifecycleRunDetail } from "@/lib/services/lifecycle-service";

export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string; runId: string } }) => {
    await requireAdminSession();
    const run = await getLifecycleRunDetail(params.id, params.runId);
    return jsonSuccess(run);
  },
);

export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string; runId: string } }) => {
    await requireAdminSession();
    await deleteLifecycleRun(params.id, params.runId);
    return jsonSuccess({ deleted: true });
  },
);
