import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeleteDocumentationButton } from "@/components/admin/delete-documentation-button";
import { MarkdownContent } from "@/components/markdown-content";
import { authOptions } from "@/lib/auth/options";
import {
  getDocumentationById,
  listDocumentationHistory,
} from "@/lib/services/documentation-service";
import { getProjectById } from "@/lib/services/project-service";

export default async function ProjectDocumentationPage({
  params,
}: {
  params: { id: string; docId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const [project, doc] = await Promise.all([
    getProjectById(params.id),
    getDocumentationById(params.docId),
  ]);

  if (doc.projectId !== project.id) {
    redirect(`/dashboard/projects/${project.id}`);
  }

  const history = await listDocumentationHistory(project.id, doc.name);

  return (
    <main className="dashboard project-dashboard">
      <AutoRefresh intervalMs={10_000} />
      <header className="ops-header">
        <div>
          <h1 className="truncate-1" title={doc.name}>{doc.name}</h1>
          <p>
            {project.name} ({project.visualId}) • Version v{doc.version}
          </p>
        </div>
        <Link href={`/dashboard/projects/${project.id}`} className="inline-action">Back to project</Link>
      </header>

      <div className="ops-shell ops-shell--config">
        <aside className="card ops-nav">
          <h2>Documentation</h2>
          <div className="ops-nav-group">
            <h3>Sections</h3>
            <ul className="ops-nav-list">
              <li><a href="#document-content">Content</a></li>
              <li><a href="#versions">Version history</a></li>
              <li><Link href={`/dashboard/projects/${project.id}/lifecycle`}>Lifecycle</Link></li>
            </ul>
          </div>
          <div className="ops-nav-group">
            <h3>Actions</h3>
            <div className="ops-actions">
              {session.user.role === "ADMIN" ? (
                <DeleteDocumentationButton
                  documentationId={doc.id}
                  redirectTo={`/dashboard/projects/${project.id}`}
                  label="Delete document"
                />
              ) : null}
              <Link href={`/dashboard/projects/${project.id}`} className="inline-action">Project overview</Link>
            </div>
          </div>
        </aside>

        <section className="ops-main">
          <section id="document-content" className="card">
            <h2>Document Content</h2>
            <MarkdownContent content={doc.content} className="doc-page-content" />
          </section>

          <section id="versions" className="card">
            <h2>Versions</h2>
            <div className="doc-list-compact">
              {history.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/dashboard/projects/${project.id}/docs/${entry.id}`}
                  className={`doc-compact-link ${entry.id === doc.id ? "active-doc" : ""}`}
                >
                  <span className="doc-title" title={entry.name}>
                    {entry.name} ({new Date(entry.createdAt).toLocaleString("de-DE")})
                  </span>
                  <span className="version-pill">v{entry.version}</span>
                </Link>
              ))}
            </div>
          </section>
        </section>

      </div>
    </main>
  );
}
