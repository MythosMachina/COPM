import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { runDomNexHealthcheck } from "@/lib/services/domnex-adapter-service";

export const POST = withErrorHandling(async () => {
  await requireAdminSession();
  const result = await runDomNexHealthcheck();
  return jsonSuccess(result);
});
