import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { runGitHubHealthcheck } from "@/lib/services/github-adapter-service";

export const POST = withErrorHandling(async () => {
  await requireAdminSession();
  const result = await runGitHubHealthcheck();
  return jsonSuccess(result);
});
