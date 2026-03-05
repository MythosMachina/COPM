import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { AgentQuestionChat } from "@/components/admin/agent-question-chat";
import { CopyUrlButton } from "@/components/copy-url-button";
import { DeleteDocumentationButton } from "@/components/admin/delete-documentation-button";
import { DeleteProjectButton } from "@/components/admin/delete-project-button";
import { authOptions } from "@/lib/auth/options";
import { buildAgentChatTimeline } from "@/lib/orchestrator/question-bridge";
import { getLatestAgentRun } from "@/lib/services/agent-run-service";
import { listLatestDocumentationByProject } from "@/lib/services/documentation-service";
import { listLifecycleRunsByProject } from "@/lib/services/lifecycle-service";
import { getProjectById } from "@/lib/services/project-service";
import { getBaseUrlFromServerHeaders, toAbsoluteUrl } from "@/lib/url/base-url";

const BEARER_PLACEHOLDER = "__COPM_BEARER_TOKEN__";

function buildKickstartPromptTemplate(args: {
  projectId: string;
  projectName: string;
  projectVisualId: string;
  apiHelpPath: string;
  aiKickstartPath: string;
  agentsMdPath: string;
  syncProjectPath: string;
  syncDocumentationPath: string;
}) {
  return [
    "You are Codex. Run in autonomous production mode and execute only for this project scope.",
    "",
    "COPM Project Binding:",
    `- Project: ${args.projectName} (${args.projectVisualId})`,
    `- Project ID: ${args.projectId}`,
    `- Bearer Token: ${BEARER_PLACEHOLDER}`,
    `- Bound workspace: workspaces/${args.projectVisualId}`,
    `- Mandatory project DB name: ${args.projectVisualId}`,
    "",
    "API Endpoints:",
    `- API Help: ${args.apiHelpPath}`,
    `- AI Kickstart: ${args.aiKickstartPath}`,
    `- AGENTS.md: ${args.agentsMdPath}`,
    `- Project Sync: ${args.syncProjectPath}`,
    `- Documentation Sync: ${args.syncDocumentationPath}`,
    "",
    "Execution:",
    `1) Fetch ai-kickstart using: curl -sS -H \"authorization: Bearer ${BEARER_PLACEHOLDER}\" \"${args.aiKickstartPath}\"`,
    "2) Use startupPrompts.systemPrompt and startupPrompts.userPrompt as primary context.",
    "3) Apply autodevSkillFull from payload as mandatory policy.",
    "4) Use apiHelp from payload for endpoint contracts and operation hints.",
    "5) Keep COPM synchronization strict for lifecycle state and documentation after every substantial step.",
    "6) Hard boundary: operate only in workspaces/<projectVisualId>; no writes outside project folder.",
    "6a) Exception: host-level deployment actions are allowed if required (e.g. create/manage project-specific systemd service).",
    "7) Hard boundary: never modify COPM core/database/services.",
    "8) Database isolation: use only dedicated DB named exactly projectVisualId; never use codex_ops.",
  ].join("\n");
}

function buildAgentsPromptTemplate(args: {
  projectId: string;
  projectName: string;
  projectVisualId: string;
  apiHelpPath: string;
  agentsMdPath: string;
  aiKickstartPath: string;
}) {
  return [
    "You are Codex. Start from AGENTS.md and then hydrate full execution context.",
    "",
    "COPM Project Binding:",
    `- Project: ${args.projectName} (${args.projectVisualId})`,
    `- Project ID: ${args.projectId}`,
    `- Bearer Token: ${BEARER_PLACEHOLDER}`,
    `- Bound workspace: workspaces/${args.projectVisualId}`,
    `- Mandatory project DB name: ${args.projectVisualId}`,
    "",
    "API Endpoints:",
    `- API Help: ${args.apiHelpPath}`,
    `- AGENTS.md: ${args.agentsMdPath}`,
    `- AI Kickstart: ${args.aiKickstartPath}`,
    "",
    "Execution:",
    `1) Fetch AGENTS.md: curl -sS -H \"authorization: Bearer ${BEARER_PLACEHOLDER}\" \"${args.agentsMdPath}\"`,
    `2) Fetch ai-kickstart: curl -sS -H \"authorization: Bearer ${BEARER_PLACEHOLDER}\" \"${args.aiKickstartPath}\"`,
    "3) Apply autodevSkillFull and startupPrompts as system and user context.",
    "4) Continue implementation with COPM as source of truth.",
    "5) Hard boundary: stay strictly inside workspaces/<projectVisualId>.",
    "5a) Exception: for persistent runtime requirements, host-level project-scoped service setup (systemd/equivalent) is allowed.",
    "6) Use project DB named exactly projectVisualId; never use codex_ops.",
  ].join("\n");
}

function formatAgentState(status: string): string {
  if (status === "RUNNING") return "RUNNING";
  if (status === "WAITING_INPUT") return "WAITING INPUT";
  if (status === "FAILED") return "FAILED";
  if (status === "DONE") return "DONE";
  if (status === "QUEUED") return "QUEUED";
  if (status === "CANCELED") return "CANCELED";
  return status;
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const project = await getProjectById(params.id);
  const [docs, latestRun, lifecycleRuns] = await Promise.all([
    listLatestDocumentationByProject(params.id),
    getLatestAgentRun(params.id),
    listLifecycleRunsByProject(params.id),
  ]);

  const docsWithoutAgentQa = docs.filter(
    (doc) => !doc.name.startsWith("QA:QUESTION:") && !doc.name.startsWith("QA:ANSWER:"),
  );
  const agentChat = buildAgentChatTimeline(docs);
  const baseUrl = await getBaseUrlFromServerHeaders();

  const aiKickstartPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}/ai-kickstart`);
  const agentsMdPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}/agents-md`);
  const apiHelpPath = toAbsoluteUrl(baseUrl, "/api/help");
  const syncProjectPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}`);
  const syncDocumentationPath = toAbsoluteUrl(baseUrl, `/api/v1/projects/${project.id}/documentation`);
  const adminExportMdPath = toAbsoluteUrl(baseUrl, `/api/v1/admin/projects/${project.id}/export/md`);
  const adminExportPdfPath = toAbsoluteUrl(baseUrl, `/api/v1/admin/projects/${project.id}/export/pdf`);

  const aiKickstartPromptTemplate = buildKickstartPromptTemplate({
    projectId: project.id,
    projectName: project.name,
    projectVisualId: project.visualId,
    apiHelpPath,
    aiKickstartPath,
    agentsMdPath,
    syncProjectPath,
    syncDocumentationPath,
  });

  const agentsPromptTemplate = buildAgentsPromptTemplate({
    projectId: project.id,
    projectName: project.name,
    projectVisualId: project.visualId,
    apiHelpPath,
    agentsMdPath,
    aiKickstartPath,
  });

  const latestLifecycle = lifecycleRuns[0] ?? null;

  return (
    <main className="dashboard project-dashboard">
      <AutoRefresh intervalMs={10_000} />

      <header className="ops-header">
        <div>
          <h1 className="truncate-1" title={project.name}>{project.name}</h1>
          <div className="ops-badge-row">
            <p className="visual-id-pill">{project.visualId}</p>
            <p className="visual-id-pill">
              Domain Provisioning: {project.autoProvisionDomain ? `ON (${project.provisionStatus})` : "OFF"}
            </p>
          </div>
        </div>
        <Link href="/dashboard" className="inline-action">Back to dashboard</Link>
      </header>

      <div className="ops-shell">
        <aside className="card ops-nav">
          <h2>Project Navigation</h2>
          <div className="ops-nav-group">
            <h3>Workspaces</h3>
            <ul className="ops-nav-list">
              <li><Link href={`/dashboard/projects/${project.id}`}>Overview</Link></li>
              <li><Link href={`/dashboard/projects/${project.id}/lifecycle`}>Lifecycle Engine</Link></li>
            </ul>
          </div>

          <div className="ops-nav-group">
            <h3>Documentation</h3>
            <ul className="ops-nav-list">
              {docsWithoutAgentQa.length === 0 ? (
                <li><span className="ops-muted">No documents</span></li>
              ) : (
                docsWithoutAgentQa.slice(0, 12).map((doc) => (
                  <li key={`nav-doc-${doc.id}`}>
                    <Link
                      href={`/dashboard/projects/${project.id}/docs/${doc.id}`}
                      className="truncate-1"
                      title={doc.name}
                    >
                      {doc.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

        <section className="ops-main">
          <div className="ops-main-grid">
            <section className="card span-6">
              <h2>Lifecycle Status</h2>
              {latestLifecycle ? (
                <div className="ops-stack">
                  <p className="ops-subtle truncate-1" title={latestLifecycle.title}>{latestLifecycle.title}</p>
                  <div className="ops-badge-row">
                    <span className="visual-id-pill">{latestLifecycle.id.slice(0, 8)}</span>
                    <span className="status-pill active">{latestLifecycle.status}</span>
                    <span className="status-pill done">{latestLifecycle.mode}</span>
                  </div>
                  <Link href={`/dashboard/projects/${project.id}/lifecycle`} className="inline-action">
                    Open lifecycle workspace
                  </Link>
                </div>
              ) : (
                <div className="ops-stack">
                  <p>No lifecycle run started yet.</p>
                  <Link href={`/dashboard/projects/${project.id}/lifecycle`} className="inline-action">
                    Create first run
                  </Link>
                </div>
              )}
            </section>

            <section className="card span-6">
              <h2>Agent Status</h2>
              <p className="agent-live-pill">{latestRun ? formatAgentState(latestRun.status) : "IDLE"}</p>
              {latestRun ? (
                <p className="ops-muted">
                  Run {latestRun.id.slice(0, 8)} updated {new Date(latestRun.updatedAt).toLocaleString("de-DE")}
                </p>
              ) : (
                <p className="ops-muted">No run recorded yet.</p>
              )}
            </section>

            <section className="card span-12">
              <h2>Documentation ({docsWithoutAgentQa.length})</h2>
              {docsWithoutAgentQa.length === 0 ? (
                <p>No documentation available.</p>
              ) : (
                <div className="doc-list-compact">
                  {docsWithoutAgentQa.map((doc) => (
                    <div key={doc.id} className="doc-compact-row">
                      <Link href={`/dashboard/projects/${project.id}/docs/${doc.id}`} className="doc-compact-link">
                        <span className="doc-title-2" title={doc.name}>{doc.name}</span>
                        <span className="version-pill">v{doc.version}</span>
                      </Link>
                      {session.user.role === "ADMIN" ? <DeleteDocumentationButton documentationId={doc.id} /> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <aside className="card ops-sidepanel">
          <h2>Operator Actions</h2>
          <div className="ops-actions">
            <AgentQuestionChat
              projectId={project.id}
              initialPayload={{
                entries: agentChat.entries,
                openQuestionCount: agentChat.openQuestionCount,
                latestOpenQuestionId: agentChat.latestOpenQuestionId,
              }}
            />

            <h3>AI Endpoints</h3>
            <CopyUrlButton label="Click to Prompt: AI Kickstart" projectId={project.id} promptTemplate={aiKickstartPromptTemplate} />
            <CopyUrlButton label="Click to Prompt: AGENTS.md" projectId={project.id} promptTemplate={agentsPromptTemplate} />

            {session.user.role === "ADMIN" ? (
              <>
                <a href={adminExportMdPath} target="_blank" rel="noreferrer" className="inline-action">
                  Export as Markdown
                </a>
                <a href={adminExportPdfPath} target="_blank" rel="noreferrer" className="inline-action">
                  Export as PDF
                </a>
                <DeleteProjectButton projectId={project.id} />
              </>
            ) : (
              <p className="ops-muted">No admin actions available.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
