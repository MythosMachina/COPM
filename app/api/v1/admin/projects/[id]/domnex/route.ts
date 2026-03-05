import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { setProjectDomNexAutoProvision } from "@/lib/services/domnex-provisioning-service";
import { adminProjectDomNexToggleSchema } from "@/lib/validation/domnex-provisioning-schemas";

export const PATCH = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const payload = adminProjectDomNexToggleSchema.parse(await request.json());
  const result = await setProjectDomNexAutoProvision(params.id, payload.enabled);
  return jsonSuccess(result);
});
