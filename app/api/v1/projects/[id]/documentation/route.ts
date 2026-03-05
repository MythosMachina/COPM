import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import {
  createDocumentation,
  deleteDocumentationByProject,
  listDocumentationByProject,
} from "@/lib/services/documentation-service";
import { createDocumentationSchema } from "@/lib/validation/documentation-schemas";

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const docs = await listDocumentationByProject(params.id);
  return jsonSuccess(docs);
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const payload = createDocumentationSchema.parse(await request.json());
  const doc = await createDocumentation(params.id, payload);
  return jsonSuccess(doc, 201);
});

export const DELETE = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const nameParam = new URL(request.url).searchParams.get("name");
  const name = nameParam?.trim() ? nameParam.trim() : undefined;
  const result = await deleteDocumentationByProject(params.id, name);
  return jsonSuccess(result);
});
