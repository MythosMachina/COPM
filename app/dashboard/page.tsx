import type { Route } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeleteProjectButton } from "@/components/admin/delete-project-button";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth/options";
import { listDashboardProjects } from "@/lib/services/dashboard-service";
import { getBaseUrlFromServerHeaders, toAbsoluteUrl } from "@/lib/url/base-url";

type DashboardPageSearchParams = {
  q?: string;
  status?: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isStatusFilter(value: string | undefined): value is "all" | "running" | "waiting" | "failed" | "idle" {
  return value === "all" || value === "running" || value === "waiting" || value === "failed" || value === "idle";
}

function formatAgentStatus(value: string | null): string {
  if (!value) return "IDLE";
  if (value === "WAITING_INPUT") return "WAITING INPUT";
  return value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardPageSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const query = searchParams?.q?.trim() ?? "";
  const statusFilter = isStatusFilter(searchParams?.status) ? searchParams?.status : "all";
  const baseUrl = await getBaseUrlFromServerHeaders();
  const { projects, summary } = await listDashboardProjects({
    query: query || undefined,
    statusFilter,
    actorUserId: session.user.id,
    actorRole: session.user.role,
  });

  return (
    <main className="dashboard dashboard-revamp">
      <AutoRefresh intervalMs={10_000} />

      <header className="ops-header">
        <div>
          <h1>Codex Operator Dashboard</h1>
          <div className="ops-badge-row">
            <span className="visual-id-pill">Operator: {session.user?.name ?? "unknown"}</span>
            <span className="visual-id-pill">Role: {session.user.role}</span>
          </div>
        </div>
        <div className="task-actions-inline">
          <SignOutButton />
        </div>
      </header>

      <div className="ops-shell">
        <aside className="card ops-nav">
          <h2>Workspace</h2>
          <div className="ops-nav-group">
            <h3>Core</h3>
            <ul className="ops-nav-list">
              <li>
                <Link href={"/dashboard" as Route}>Dashboard Home</Link>
              </li>
              <li>
                <Link href={"/dashboard/projects/new" as Route}>Create Lifecycle Project</Link>
              </li>
              <li>
                <Link href={"/dashboard/config" as Route}>Config Workspace</Link>
              </li>
            </ul>
          </div>

          <div className="ops-nav-group">
            <h3>Filters</h3>
            <form method="get" className="ops-stack">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search projects..."
                aria-label="Search projects"
              />
              <select name="status" defaultValue={statusFilter} aria-label="Filter by agent state">
                <option value="all">All</option>
                <option value="running">Agent running</option>
                <option value="waiting">Agent waiting input</option>
                <option value="failed">Agent failed</option>
                <option value="idle">Idle / done</option>
              </select>
              <button type="submit">Apply filter</button>
              <Link href={"/dashboard" as Route} className="inline-action">
                Reset
              </Link>
            </form>
          </div>
        </aside>

        <section className="ops-main">
          <section className="card ops-kpi">
            <div className="stat-tile">
              <p>Projects</p>
              <strong>{summary.projectCount}</strong>
            </div>
            <div className="stat-tile">
              <p>Agent Running</p>
              <strong>{summary.agentRunningCount}</strong>
            </div>
            <div className="stat-tile">
              <p>Agent Waiting</p>
              <strong>{summary.agentWaitingCount}</strong>
            </div>
            <div className="stat-tile">
              <p>Agent Failed</p>
              <strong>{summary.agentFailedCount}</strong>
            </div>
          </section>

          <section className="card">
            <h2>Projects ({projects.length})</h2>
            {projects.length === 0 ? (
              <p>No projects for current filter.</p>
            ) : (
              <ul className="project-card-grid">
                {projects.map((project) => {
                  const aiKickstartPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}/ai-kickstart`);
                  const agentsMdPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}/agents-md`);
                  const isFailure = project.latestAgentStatus === "FAILED";

                  return (
                    <li key={project.id} className="project-card">
                      <div className="project-card-head">
                        <Link href={`/dashboard/projects/${project.id}`} className="project-link truncate-1" title={project.name}>
                          <strong className="truncate-1">{project.name}</strong>
                        </Link>
                        <span className="updated-pill">Updated {formatDate(project.updatedAt)}</span>
                      </div>

                      <div className="ops-badge-row">
                        <p className="visual-id-pill">{project.visualId}</p>
                        <span className={`metric-pill ${isFailure ? "docs" : "active"}`}>
                          {formatAgentStatus(project.latestAgentStatus)}
                        </span>
                      </div>

                      <p className="project-target">{project.target}</p>

                      <div className="project-health">
                        <span className="metric-pill neutral">Runs {project.lifecycleRunCount}</span>
                        <span className="metric-pill docs">Docs {project.documentationCount}</span>
                        <span className="metric-pill neutral">
                          Agent update {project.latestAgentUpdatedAt ? formatDate(project.latestAgentUpdatedAt) : "n/a"}
                        </span>
                      </div>
                      {project.latestAgentFailureReason ? <p className="error">{project.latestAgentFailureReason}</p> : null}

                      <div className="project-actions-row">
                        <Link href={`/dashboard/projects/${project.id}`} className="inline-action">
                          Open workspace
                        </Link>
                        <Link href={`/dashboard/projects/${project.id}/lifecycle`} className="inline-action">
                          Open lifecycle
                        </Link>
                      </div>

                      <details className="tech-links">
                        <summary>Machine endpoints</summary>
                        <code>{aiKickstartPath}</code>
                        <code>{agentsMdPath}</code>
                      </details>

                      {session.user.role === "ADMIN" ? (
                        <div className="project-delete">
                          <DeleteProjectButton projectId={project.id} label="Delete project" />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>

        <aside className="card ops-sidepanel">
          <h2>Control Panel</h2>
          <div className="ops-stack">
            <p className="ops-subtle">API reference</p>
            <a href={toAbsoluteUrl(baseUrl, "/api/help")} target="_blank" rel="noreferrer" className="inline-action">
              Open API Help
            </a>
            <hr className="ops-separator" />
            <p className="ops-subtle">Recent projects</p>
            <ul className="ops-compact-list">
              {projects.slice(0, 8).map((project) => (
                <li key={`sidebar-${project.id}`}>
                  <div className="ops-compact-row">
                    <Link href={`/dashboard/projects/${project.id}`}>{project.visualId}</Link>
                    <span className="status-pill active">{formatAgentStatus(project.latestAgentStatus)}</span>
                  </div>
                  <p className="task-summary-compact truncate-1" title={project.name}>{project.name}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
