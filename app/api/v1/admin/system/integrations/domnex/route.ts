import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { getDomNexAdapterConfig, updateDomNexAdapterConfig } from "@/lib/services/domnex-adapter-service";
import { updateDomNexAdapterSchema } from "@/lib/validation/domnex-adapter-schemas";

export const GET = withErrorHandling(async () => {
  await requireAdminSession();
  const config = await getDomNexAdapterConfig();
  return jsonSuccess(config);
});

export const PUT = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const payload = updateDomNexAdapterSchema.parse(await request.json());
  const config = await updateDomNexAdapterConfig(payload);
  return jsonSuccess(config);
});
