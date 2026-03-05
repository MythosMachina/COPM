import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { createManagedUser, listManagedUsers } from "@/lib/services/user-admin-service";
import { createManagedUserSchema } from "@/lib/validation/admin-user-schemas";

export const GET = withErrorHandling(async () => {
  await requireAdminSession();
  const data = await listManagedUsers();
  return jsonSuccess(data);
});

export const POST = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const payload = createManagedUserSchema.parse(await request.json());
  const user = await createManagedUser(payload);
  return jsonSuccess(user, 201);
});
