import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { deleteProject, getProjectById, updateProject } from "@/lib/services/project-service";
import { updateProjectSchema } from "@/lib/validation/project-schemas";

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const project = await getProjectById(params.id);
  return jsonSuccess(project);
});

export const PATCH = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const payload = updateProjectSchema.parse(await request.json());
  const project = await updateProject(params.id, payload);
  return jsonSuccess(project);
});

export const DELETE = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const result = await deleteProject(params.id);
  return jsonSuccess(result);
});
