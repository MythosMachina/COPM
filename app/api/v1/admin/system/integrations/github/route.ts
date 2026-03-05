import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { getGitHubAdapterConfig, updateGitHubAdapterConfig } from "@/lib/services/github-adapter-service";
import { updateGitHubAdapterSchema } from "@/lib/validation/github-adapter-schemas";

export const GET = withErrorHandling(async () => {
  await requireAdminSession();
  const config = await getGitHubAdapterConfig();
  return jsonSuccess(config);
});

export const PUT = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const payload = updateGitHubAdapterSchema.parse(await request.json());
  const config = await updateGitHubAdapterConfig(payload);
  return jsonSuccess(config);
});
