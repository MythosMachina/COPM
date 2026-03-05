import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { deleteDocumentation, updateDocumentation } from "@/lib/services/documentation-service";
import { updateDocumentationSchema } from "@/lib/validation/documentation-schemas";

export const PATCH = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request);
  const payload = updateDocumentationSchema.parse(await request.json());
  const document = await updateDocumentation(params.id, payload);
  return jsonSuccess(document);
});

export const DELETE = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request);
  const result = await deleteDocumentation(params.id);
  return jsonSuccess(result);
});
