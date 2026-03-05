import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { LifecycleManager } from "@/components/admin/lifecycle-manager";
import { authOptions } from "@/lib/auth/options";
import { getLifecycleRunDetail, listLifecycleRunsByProject } from "@/lib/services/lifecycle-service";
import { getProjectById } from "@/lib/services/project-service";

export default async function ProjectLifecycleBuilderPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const project = await getProjectById(params.id);
  const runs = await listLifecycleRunsByProject(project.id);
  const draftSourceRun = runs[0] ? await getLifecycleRunDetail(project.id, runs[0].id) : null;

  return (
    <main className="dashboard project-dashboard">
      <AutoRefresh intervalMs={10_000} />
      <header className="ops-header">
        <div>
          <h1>Lifecycle Builder</h1>
          <p className="truncate-1" title={`${project.name} (${project.visualId})`}>
            {project.name} ({project.visualId})
          </p>
        </div>
        <Link href={`/dashboard/projects/${project.id}/lifecycle`} className="inline-action">
          Back to lifecycle workspace
        </Link>
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
        </aside>

        <section className="ops-main">
          <LifecycleManager
            projectId={project.id}
            runs={runs}
            activeRun={null}
            draftRun={draftSourceRun}
            docs={[]}
            showRunBuilder
          />
        </section>
      </div>
    </main>
  );
}
