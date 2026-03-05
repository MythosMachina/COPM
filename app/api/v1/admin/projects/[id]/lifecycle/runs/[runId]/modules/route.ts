import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { appendLifecycleModule } from "@/lib/services/lifecycle-service";
import { appendLifecycleModuleSchema } from "@/lib/validation/lifecycle-schemas";

export const POST = withErrorHandling(
  async (request: Request, { params }: { params: { id: string; runId: string } }) => {
    await requireAdminSession();
    const payload = appendLifecycleModuleSchema.parse(await request.json());
    const run = await appendLifecycleModule(params.id, params.runId, payload);
    return jsonSuccess(run, 201);
  },
);
