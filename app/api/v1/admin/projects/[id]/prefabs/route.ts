import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { applyPrefabToProject } from "@/lib/services/prefab-task-service";
import { adminProjectPrefabSchema } from "@/lib/validation/prefab-schemas";

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const payload = adminProjectPrefabSchema.parse(await request.json());
  const result = await applyPrefabToProject({
    projectId: params.id,
    type: payload.type,
    repoUrl: payload.repoUrl,
    fqdn: payload.fqdn,
    upstreamUrl: payload.upstreamUrl,
    executionOrder: payload.executionOrder,
  });
  return jsonSuccess(result, 201);
});
