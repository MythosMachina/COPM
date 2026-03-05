import { withErrorHandling } from "@/lib/api/with-error-handling";
import { assertCodexApiKey } from "@/lib/auth/codex-auth";
import { buildAgentsMarkdownForProject } from "@/lib/services/project-admin-service";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "project";
}

export const GET = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  await assertCodexApiKey(request, { projectId: params.id });
  const markdown = await buildAgentsMarkdownForProject(params.id);

  const nameLine = markdown.split("\n").find((line) => line.startsWith("- Name: ")) ?? "- Name: project";
  const projectName = nameLine.replace("- Name: ", "").trim();
  const filename = `${slugify(projectName)}-AGENTS.md`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "cache-control": "no-store",
    },
  });
});
