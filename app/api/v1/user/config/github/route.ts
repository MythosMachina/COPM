import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireOperatorSession } from "@/lib/auth/session-auth";
import { getUserGitHubConfig, updateUserGitHubConfig } from "@/lib/services/github-adapter-service";
import { updateUserGitHubConfigSchema } from "@/lib/validation/admin-user-schemas";

export const GET = withErrorHandling(async () => {
  const session = await requireOperatorSession();
  const config = await getUserGitHubConfig(session.user.id);
  return jsonSuccess(config);
});

export const PUT = withErrorHandling(async (request: Request) => {
  const session = await requireOperatorSession();
  const payload = updateUserGitHubConfigSchema.parse(await request.json());
  const config = await updateUserGitHubConfig(session.user.id, payload);
  return jsonSuccess(config);
});
