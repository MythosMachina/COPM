import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { teardownDomNexProject } from "@/lib/services/domnex-provisioning-service";
import { adminProjectDomNexTeardownSchema } from "@/lib/validation/domnex-provisioning-schemas";

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  const session = await requireAdminSession();
  const payload = adminProjectDomNexTeardownSchema.parse(await request.json());
  const result = await teardownDomNexProject({
    projectId: params.id,
    clearFqdn: payload.clearFqdn ?? false,
    clearDocumentation: payload.clearDocumentation ?? false,
    clearWorkspace: payload.clearWorkspace ?? false,
    reason: "manual-teardown",
    initiatedBy: session.user.email ?? session.user.id,
  });
  return jsonSuccess(result);
});
