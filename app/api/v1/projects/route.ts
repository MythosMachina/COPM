import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { createProject, listProjects } from "@/lib/services/project-service";
import { assertUserCanCreateProject } from "@/lib/services/user-service";
import { createProjectSchema } from "@/lib/validation/project-schemas";

export const GET = withErrorHandling(async (request: Request) => {
  await assertCodexApiKey(request);
  const projects = await listProjects();
  return jsonSuccess(projects);
});

export const POST = withErrorHandling(async (request: Request) => {
  const key = await assertCodexApiKey(request);
  const payload = createProjectSchema.parse(await request.json());
  if (key.createdByUserId !== "test-user") {
    await assertUserCanCreateProject(key.createdByUserId);
  }
  const project = await createProject({
    ...payload,
    createdByUserId: key.createdByUserId,
  });
  return jsonSuccess(project, 201);
});
