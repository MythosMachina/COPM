import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { LifecycleManager } from "@/components/admin/lifecycle-manager";
import { authOptions } from "@/lib/auth/options";
import { listLatestDocumentationByProject } from "@/lib/services/documentation-service";
import { getLifecycleRunDetail, listLifecycleRunsByProject } from "@/lib/services/lifecycle-service";
import { getProjectById } from "@/lib/services/project-service";

export default async function ProjectLifecyclePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const project = await getProjectById(params.id);
  const [runs, docs] = await Promise.all([
    listLifecycleRunsByProject(project.id),
    listLatestDocumentationByProject(project.id),
  ]);
  const statusPriority: Array<"RUNNING" | "BLOCKED" | "READY" | "DEPLOYED" | "DRAFT"> = [
    "RUNNING",
    "BLOCKED",
    "READY",
    "DEPLOYED",
    "DRAFT",
  ];
  const activeCandidate =
    statusPriority
      .map((status) => runs.find((run) => run.status === status) ?? null)
      .find((run) => run !== null) ?? null;
  const activeRun = activeCandidate ? await getLifecycleRunDetail(project.id, activeCandidate.id) : null;
  const draftSourceRun = activeRun ? activeRun : runs[0] ? await getLifecycleRunDetail(project.id, runs[0].id) : null;

  return (
    <main className="dashboard project-dashboard">
      <AutoRefresh intervalMs={10_000} />
      <header className="ops-header">
        <div>
          <h1>Lifecycle Workspace</h1>
          <p className="truncate-1" title={`${project.name} (${project.visualId})`}>
            {project.name} ({project.visualId})
          </p>
        </div>
        <Link href={`/dashboard/projects/${project.id}`} className="inline-action">Back to project overview</Link>
      </header>

      <div className="ops-shell ops-shell--config">
        <aside className="card ops-nav">
          <h2>Lifecycle Nav</h2>
          <div className="ops-nav-group">
            <h3>Project</h3>
            <ul className="ops-nav-list">
              <li><Link href={`/dashboard/projects/${project.id}`}>Overview</Link></li>
              <li><Link href={`/dashboard/projects/${project.id}/lifecycle`}>Lifecycle</Link></li>
              <li><Link href={`/dashboard/projects/${project.id}/lifecycle/new`}>Lifecycle Builder</Link></li>
            </ul>
          </div>
          <div className="ops-nav-group">
            <h3>Run Snapshots</h3>
            <ul className="ops-nav-list">
              {runs.length === 0 ? (
                <li><span className="ops-muted">No runs</span></li>
              ) : (
                runs.slice(0, 16).map((run) => (
                  <li key={`run-side-${run.id}`}>
                    <span className="truncate-1" title={`${run.id.slice(0, 8)} · ${run.status} · ${run.mode}`}>
                      {run.id.slice(0, 8)} · {run.status} · {run.mode}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

        <section className="ops-main">
          <LifecycleManager
            projectId={project.id}
            runs={runs}
            activeRun={activeRun}
            draftRun={draftSourceRun}
            docs={docs}
            showRunBuilder={false}
          />
        </section>
      </div>
    </main>
  );
}
