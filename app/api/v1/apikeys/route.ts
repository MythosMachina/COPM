import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { createApiKey, listApiKeys } from "@/lib/services/apikey-service";
import { createApiKeySchema } from "@/lib/validation/apikey-schemas";

export const GET = withErrorHandling(async () => {
  await requireAdminSession();
  const keys = await listApiKeys();
  return jsonSuccess(keys);
});

export const POST = withErrorHandling(async (request: Request) => {
  const session = await requireAdminSession();
  const payload = createApiKeySchema.parse(await request.json());

  const created = await createApiKey({
    name: payload.name,
    createdByUserId: session.user.id,
  });

  return jsonSuccess(created, 201);
});
