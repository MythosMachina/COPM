import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireOperatorSession } from "@/lib/auth/session-auth";
import { runUserGitHubHealthcheck } from "@/lib/services/github-adapter-service";

export const POST = withErrorHandling(async () => {
  const session = await requireOperatorSession();
  const result = await runUserGitHubHealthcheck(session.user.id);
  return jsonSuccess(result);
});
