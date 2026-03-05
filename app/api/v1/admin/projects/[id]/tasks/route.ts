import { ValidationError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";

export const POST = withErrorHandling(async () => {
  await requireAdminSession();
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
});
