import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireOperatorSession } from "@/lib/auth/session-auth";
import { createApiKey } from "@/lib/services/apikey-service";
import { getProjectById } from "@/lib/services/project-service";
import { verifyUserPassword } from "@/lib/services/user-service";
import { createProjectPromptTokenSchema } from "@/lib/validation/apikey-schemas";

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  const session = await requireOperatorSession();
  const payload = createProjectPromptTokenSchema.parse(await request.json());

  await verifyUserPassword(session.user.id, payload.password);
  const project = await getProjectById(params.id);

  const created = await createApiKey({
    name: `Prompt ${project.visualId}`,
    createdByUserId: session.user.id,
    projectId: params.id,
  });

  return jsonSuccess(
    {
      token: created.token,
      keyId: created.id,
      keyPrefix: created.keyPrefix,
      projectId: params.id,
      projectVisualId: project.visualId,
    },
    201,
  );
});
