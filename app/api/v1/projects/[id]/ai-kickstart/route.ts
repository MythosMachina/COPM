import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { buildAiKickstartPayload } from "@/lib/services/project-admin-service";
import { getBaseUrlFromRequest } from "@/lib/url/base-url";

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const payload = await buildAiKickstartPayload(params.id, getBaseUrlFromRequest(request));
  return jsonSuccess(payload);
});
