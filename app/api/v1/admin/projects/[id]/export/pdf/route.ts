import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { buildProjectPdfDocument, getProjectExportBundle } from "@/lib/services/project-export-service";

export const runtime = "nodejs";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "project";
}

export const GET = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireAdminSession();
  const bundle = await getProjectExportBundle(params.id);
  const pdf = await buildProjectPdfDocument(params.id);
  const pdfBytes = new Uint8Array(pdf);

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=\"${slugify(bundle.project.name)}-project-report.pdf\"`,
      "cache-control": "no-store",
    },
  });
});
