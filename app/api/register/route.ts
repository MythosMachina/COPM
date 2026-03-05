import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { registerInitialUser } from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validation/user-schemas";

export const POST = withErrorHandling(async (request: Request) => {
  const payload = registerSchema.parse(await request.json());
  const user = await registerInitialUser(payload);
  return jsonSuccess(user, 201);
});
