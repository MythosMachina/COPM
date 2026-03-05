import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { syncDomNexApexDomainsFromApi } from "@/lib/services/domnex-adapter-service";

export const POST = withErrorHandling(async () => {
  await requireAdminSession();
  const data = await syncDomNexApexDomainsFromApi();
  return jsonSuccess(data);
});
