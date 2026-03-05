import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { createProjectBootstrap } from "@/lib/services/project-admin-service";
import { assertUserCanCreateProject } from "@/lib/services/user-service";
import { adminBootstrapProjectSchema } from "@/lib/validation/admin-project-schemas";

export const POST = withErrorHandling(async (request: Request) => {
  const session = await requireAdminSession();
  await assertUserCanCreateProject(session.user.id);
  const payload = adminBootstrapProjectSchema.parse(await request.json());
  const result = await createProjectBootstrap(payload, session.user.id);
  return jsonSuccess(result, 201);
});
