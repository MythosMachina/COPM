import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { deleteProject } from "@/lib/services/project-service";

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const result = await deleteProject(params.id);
  return jsonSuccess(result);
});
