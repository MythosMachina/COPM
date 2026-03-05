import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildApiHelpData } from "@/lib/services/api-help-service";
import { getOrCreateAutodevSystemPreset } from "@/lib/services/system-preset-service";
import { toAbsoluteUrl } from "@/lib/url/base-url";

type BootstrapModuleInput = {
  moduleOrder: number;
  moduleType: "TECHSTACK" | "FEATURE" | "CHECK" | "DOMAIN" | "DEPLOY" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "CUSTOM";
  title: string;
  description: string;
  expectedState: string;
  config?: unknown;
  gateRequired?: boolean;
  completionPolicy?: "PAUSE_ALWAYS" | "PAUSE_ON_RISK" | "CONTINUE_AUTOMATIC";
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
};

type BootstrapDocumentationInput = {
  name: string;
  content: string;
};

type BootstrapProjectInput = {
  name: string;
  target: string;
  autoProvisionDomain?: boolean;
  lifecycle: {
    title: string;
    mode: "STEP" | "BATCH";
    classification: "BIRTH" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "DEPLOYED";
    autoStart: boolean;
    modules: BootstrapModuleInput[];
  };
  documentation: BootstrapDocumentationInput[];
};

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export async function createProjectBootstrap(input: BootstrapProjectInput, createdByUserId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: input.name,
          target: input.target,
          createdByUserId,
          autoProvisionDomain: input.autoProvisionDomain ?? false,
        },
      });

      const run = await tx.lifecycleRun.create({
        data: {
          projectId: project.id,
          title: input.lifecycle.title,
          mode: input.lifecycle.mode,
          classification: input.lifecycle.classification,
          status: "DRAFT",
        },
      });

      const createdModules = await Promise.all(
        [...input.lifecycle.modules]
          .sort((a, b) => a.moduleOrder - b.moduleOrder)
          .map((module) =>
            tx.lifecycleModule.create({
              data: {
                runId: run.id,
                moduleOrder: module.moduleOrder,
                moduleType: module.moduleType,
                title: module.title,
                description: module.description,
                expectedState: module.expectedState,
                config: toJsonInput(module.config),
                gateRequired: module.gateRequired ?? module.moduleType === "CHECK",
                completionPolicy:
                  module.completionPolicy ??
                  (input.lifecycle.mode === "STEP"
                    ? "PAUSE_ALWAYS"
                    : module.riskLevel === "HIGH"
                      ? "PAUSE_ON_RISK"
                      : "CONTINUE_AUTOMATIC"),
                riskLevel: module.riskLevel ?? "MEDIUM",
                status: "PENDING",
              },
            }),
          ),
      );

      const nameVersionMap = new Map<string, number>();
      const createdDocs = [] as Array<{ id: string; name: string; version: number }>;

      for (const doc of input.documentation) {
        const nextVersion = (nameVersionMap.get(doc.name) ?? 0) + 1;
        nameVersionMap.set(doc.name, nextVersion);

        const created = await tx.documentation.create({
          data: {
            projectId: project.id,
            name: doc.name,
            content: doc.content,
            version: nextVersion,
          },
          select: {
            id: true,
            name: true,
            version: true,
          },
        });

        createdDocs.push(created);
      }

      return {
        project: {
          id: project.id,
          visualId: project.visualId,
          name: project.name,
          target: project.target,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
        lifecycleRun: {
          id: run.id,
          title: run.title,
          mode: run.mode,
          status: run.status,
          moduleCount: createdModules.length,
        },
        documentation: createdDocs,
      };
    });
  } catch (error) {
    throw new ValidationError("Unable to create project bootstrap package", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

function sanitizeHeading(value: string): string {
  return value.replace(/\r/g, "").trim();
}

function sanitizeMultiline(value: string): string {
  return value.replace(/\r/g, "").trim();
}

export async function buildAgentsMarkdownForProject(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        orderBy: [
          { status: "asc" },
          { executionOrder: "asc" },
          { updatedAt: "desc" },
        ],
      },
      lifecycleRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          modules: {
            orderBy: { moduleOrder: "asc" },
          },
        },
      },
      documentation: {
        orderBy: [
          { name: "asc" },
          { version: "asc" },
        ],
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const lines: string[] = [];
  lines.push("# AGENTS.md");
  lines.push("");
  lines.push("## Project");
  lines.push("");
  lines.push(`- Name: ${sanitizeHeading(project.name)}`);
  lines.push(`- VisualID: ${project.visualId}`);
  lines.push(`- ID: ${project.id}`);
  lines.push(`- GeneratedAtUTC: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Objective");
  lines.push("");
  lines.push(sanitizeMultiline(project.target));
  lines.push("");

  lines.push("## Lifecycle Modules");
  lines.push("");
  const latestRun = project.lifecycleRuns[0];
  if (!latestRun || latestRun.modules.length === 0) {
    lines.push("No lifecycle modules defined.");
    lines.push("");
  } else {
    lines.push(`- Run: ${latestRun.title}`);
    lines.push(`- RunStatus: ${latestRun.status}`);
    lines.push(`- RunMode: ${latestRun.mode}`);
    lines.push(`- Classification: ${latestRun.classification}`);
    lines.push("");
    latestRun.modules.forEach((module) => {
      lines.push(`### Module ${module.moduleOrder}: ${sanitizeHeading(module.title)} (${module.moduleType})`);
      lines.push(`- Status: ${module.status}`);
      lines.push(`- Description: ${sanitizeMultiline(module.description)}`);
      lines.push(`- ExpectedState: ${sanitizeMultiline(module.expectedState)}`);
      lines.push(`- GateRequired: ${module.gateRequired}`);
      lines.push(`- CompletionPolicy: ${module.completionPolicy}`);
      lines.push(`- RiskLevel: ${module.riskLevel}`);
      lines.push("");
    });
  }

  if (project.tasks.length > 0) {
    lines.push("## Legacy Tasks (Read-Only Archive)");
    lines.push("");
    project.tasks.forEach((task) => {
      lines.push(`- ${task.visualId} | #${task.executionOrder} | ${task.status} | ${sanitizeHeading(task.title)}`);
    });
    lines.push("");
  }

  lines.push("## Documentation");
  lines.push("");

  if (project.documentation.length === 0) {
    lines.push("No documentation defined.");
    lines.push("");
  } else {
    project.documentation.forEach((doc, index) => {
      lines.push(`### Document ${index + 1}: ${sanitizeHeading(doc.name)} (v${doc.version})`);
      lines.push("```markdown");
      lines.push(sanitizeMultiline(doc.content));
      lines.push("```");
      lines.push("");
    });
  }

  lines.push("## API Notes");
  lines.push("");
  lines.push("- Use /api/v1/projects/:id, /tasks, /documentation for synchronization.");
  lines.push("- This file is generated for machine and operator consumption.");

  return `${lines.join("\n")}\n`;
}

function buildAutodevExcerpt(content: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Autarker Entwicklungsmodus");
  if (start === -1) {
    return [
      "## Autodev Excerpt",
      "- Global system preset loaded from COPM.",
      "- Section 'Autarker Entwicklungsmodus' was not found in the preset.",
    ].join("\n");
  }

  const end = lines.findIndex((line, idx) => idx > start && line.startsWith("## "));
  const block = lines.slice(start, end === -1 ? lines.length : end).join("\n").trim();
  return `## Autodev Excerpt\n${block}`;
}

export async function buildAiKickstartPayload(projectId: string, baseUrl: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, visualId: true, name: true },
  });
  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const agentsMarkdown = await buildAgentsMarkdownForProject(projectId);
  const autodevSkillFull = await getOrCreateAutodevSystemPreset();
  const autodevExcerpt = buildAutodevExcerpt(autodevSkillFull);
  const apiHelp = buildApiHelpData(baseUrl);
  const endpointIndex = Object.fromEntries(
    apiHelp.endpoints.map((entry) => [entry.path, { method: entry.method, statusCodes: entry.statusCodes }]),
  );
  const systemPrompt = [
    "You are Codex running in autonomous production mode.",
    "Use COPM as source of truth and keep implementation and docs synchronized.",
    "Lifecycle module plan is authoritative for execution. Legacy task endpoints are archive/compatibility only unless explicitly requested.",
    "Conflict resolution priority: runtime execution rules > lifecycle module plan > AGENTS.md narrative > generic autodev defaults.",
    "Hard boundary: execute only within the project workspace (workspaces/<projectVisualId>).",
    "Exception: host-level runtime provisioning is allowed when required by lifecycle/task scope (e.g. project-specific systemd service for persistent runtime).",
    "Host-level changes must remain strictly project-scoped and must not touch unrelated services.",
    "Hard boundary: never modify COPM core files/services/database; COPM is control-plane only.",
    "Database isolation: each project must use a dedicated database named exactly as project visual ID (PRJ-*).",
    "Never use COPM operations DB (codex_ops) for project runtime/app data.",
    "",
    "Autodev runtime contract (effective in this run):",
    "1) If project data is sufficient, skip any question phase and proceed autonomously.",
    "2) PREPHASE means review/proposals only, no implementation/provisioning/deploy.",
    "3) BUILD means execute modules in order and keep COPM state synchronized.",
    "4) Ask follow-up questions only when required inputs are truly missing.",
    "For domain provisioning, treat service reachability as a hard gate before marking tasks DONE.",
    "Never finalize provisioning tasks if upstream is not reachable from DomNex preflight.",
    "",
    "Domain provisioning hard rules:",
    "1) Resolve target FQDN and verify it is allowed by the active DomNex token/zone context.",
    "2) Start/ensure the application service is running before any DomNex preflight/create call.",
    "2a) Provisioning hard gate: app must run as persistent autostart service (systemd or platform equivalent), not only as a temporary process.",
    "3) Use a deterministic upstream endpoint (host/IP + port) and verify health endpoint availability.",
    "4) Verify reachability from local, LAN and DomNex network perspective before preflight.",
    "5) Run DomNex preflight first. Only run create if preflight.ready=true.",
    "6) If preflight returns upstream_reachable=false: keep task ACTIVE, fix runtime reachability, retry preflight.",
    "7) Do not silently fallback to another domain without documenting why and syncing COPM task/doc updates.",
    "8) Never use COPM service endpoint/port as project upstream unless task explicitly requires COPM itself as target.",
    "9) If task says website exists on a specific app port, verify that same app port is actually listening before marking DONE.",
    "",
    autodevExcerpt,
    "",
    "Full autodev preset is provided in payload field autodevSkillFull for reference/install.",
  ].join("\n");

  const userPrompt = [
    "Use the following AGENTS.md as authoritative project scope.",
    "Execute lifecycle modules strictly by moduleOrder (ascending) with production-ready outputs.",
    "Treat legacy tasks as read-only archive unless explicitly referenced by current lifecycle module.",
    "Keep API and documentation in sync while implementing.",
    "For provisioning tasks: include explicit evidence (health checks, preflight result, selected fqdn/upstream, create result) before closing task status.",
    "For runtime automation prefer token-auth endpoints under /api/v1/projects/:id/... (avoid /api/v1/admin/... session endpoints).",
    "Prefer lifecycle engine endpoints (/api/v1/projects/:id/lifecycle/runs...) for vNext module-based execution; treat legacy task endpoints as compatibility mode.",
    "Do not mix COPM API runtime (port 3300) with project app runtime unless explicitly defined by task scope.",
    "Hard boundary: stay inside project workspace only; no writes outside the bound project folder.",
    "Exception: if lifecycle/task requires persistent host runtime, create/manage only project-scoped service units (systemd or equivalent).",
    "Use project-dedicated DB name equal to project visual ID (PRJ-*). Do not use codex_ops.",
    "",
    agentsMarkdown,
  ].join("\n");

  const oneShotPrompt = [
    "[SYSTEM PROMPT]",
    systemPrompt,
    "",
    "[USER PROMPT]",
    userPrompt,
  ].join("\n");

  return {
    version: "ai-kickstart-v1",
    projectId,
    generatedAtUtc: new Date().toISOString(),
    endpointUsage: {
      downloadAgentsMd: toAbsoluteUrl(baseUrl, `/api/v1/projects/${projectId}/agents-md`),
      syncProject: toAbsoluteUrl(baseUrl, `/api/v1/projects/${projectId}`),
      syncTasks: toAbsoluteUrl(baseUrl, `/api/v1/projects/${projectId}/tasks`),
      syncDocumentation: toAbsoluteUrl(baseUrl, `/api/v1/projects/${projectId}/documentation`),
      projectDatabaseName: project.visualId,
    },
    installInstructions: [
      "Ensure a local skills directory exists: mkdir -p $CODEX_HOME/skills",
      "Fetch autodev preset from COPM ai-kickstart payload (autodevSkillFull) as source of truth",
      "Install skill via installer workflow (recommended): use skill-installer and install 'autodev'",
      "Fallback manual install: write autodevSkillFull into $CODEX_HOME/skills/autodev/SKILL.md",
      "If DomNex adapter is configured globally in COPM, worker runtime injects DOMNEX_BASE_URL and DOMNEX_API_TOKEN automatically.",
      "If GitHub adapter is configured globally in COPM, worker runtime injects GITHUB_API_TOKEN, GITHUB_USERNAME and GITHUB_EMAIL automatically.",
      "Restart Codex session and trigger with: autodev aktivieren",
    ],
    recommendedPrompt: [
      "Use the AGENTS.md content below as the authoritative project scope.",
      "Apply autodev execution mode for autonomous production-ready implementation.",
      "Keep docs and API contracts synchronized during implementation.",
      "If DOMNEX_BASE_URL and DOMNEX_API_TOKEN exist in runtime env, use them for domain automation tasks.",
      "If GITHUB_API_TOKEN/GITHUB_USERNAME/GITHUB_EMAIL exist in runtime env, use them for push/release prefab tasks.",
      "Do not complete provisioning tasks until upstream reachability and DomNex preflight/create are fully validated and synced.",
      "Provisioning requires persistent runtime setup (systemd/autostart or equivalent); temporary agent-started services are not sufficient.",
      "Do not treat COPM endpoint itself as project upstream unless this is explicitly requested in task scope.",
    ],
    autodevExcerpt,
    autodevSkillFull,
    startupPrompts: {
      systemPrompt,
      userPrompt,
      oneShotPrompt,
      usage:
        "Preferred: set systemPrompt in CLI system context and userPrompt as first instruction. Fallback: use oneShotPrompt in a single paste.",
    },
    apiHelp,
    endpointIndex,
    projectPlanAgentsMd: agentsMarkdown,
  };
}
