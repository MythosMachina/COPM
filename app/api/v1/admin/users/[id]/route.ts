import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { updateManagedUser } from "@/lib/services/user-admin-service";
import { updateManagedUserSchema } from "@/lib/validation/admin-user-schemas";

export const PATCH = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const payload = updateManagedUserSchema.parse(await request.json());
  const user = await updateManagedUser(params.id, payload);
  return jsonSuccess(user);
});
