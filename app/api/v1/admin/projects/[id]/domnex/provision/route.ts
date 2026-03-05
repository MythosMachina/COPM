import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { queueDomNexProvisionForProject } from "@/lib/services/domnex-provisioning-service";
import { adminProjectDomNexProvisionSchema } from "@/lib/validation/domnex-provisioning-schemas";

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const payload = adminProjectDomNexProvisionSchema.parse(await request.json());
  const result = await queueDomNexProvisionForProject(params.id, payload);
  return jsonSuccess(result, 202);
});
