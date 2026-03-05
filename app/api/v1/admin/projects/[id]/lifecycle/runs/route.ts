import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { createLifecycleRun, listLifecycleRunsByProject } from "@/lib/services/lifecycle-service";
import { createLifecycleRunSchema } from "@/lib/validation/lifecycle-schemas";

export const GET = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const runs = await listLifecycleRunsByProject(params.id);
  return jsonSuccess(runs);
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const payload = createLifecycleRunSchema.parse(await request.json());
  const result = await createLifecycleRun(params.id, payload);
  return jsonSuccess(result, 201);
});
