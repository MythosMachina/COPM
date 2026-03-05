import { ValidationError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";

export const PATCH = withErrorHandling(async (request: Request) => {
  await assertCodexApiKey(request);
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
});

export const DELETE = withErrorHandling(async (request: Request) => {
  await assertCodexApiKey(request);
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
});
