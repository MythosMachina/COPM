import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { deleteDocumentation } from "@/lib/services/documentation-service";

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const result = await deleteDocumentation(params.id);
  return jsonSuccess(result);
});
