import { ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { teardownDomNexProject } from "@/lib/services/domnex-provisioning-service";
import { getGitHubRuntimeSecretsForProject } from "@/lib/services/github-adapter-service";

type PrefabType = "DOMNEX_PROVISION" | "DOMNEX_TEARDOWN" | "GITHUB_RELEASE";

type ApplyPrefabInput = {
  projectId: string;
  type: PrefabType;
  repoUrl?: string;
  fqdn?: string;
  upstreamUrl?: string;
  executionOrder?: number;
};

function ensureRepoUrl(value: string | undefined): string {
  if (!value) {
    throw new ValidationError("repoUrl is required for GITHUB_RELEASE prefab");
  }
  return value;
}

function buildPrefab(taskType: PrefabType, input: { repoUrl?: string; fqdn?: string; upstreamUrl?: string }) {
  if (taskType === "DOMNEX_PROVISION") {
    const requestedFqdn = input.fqdn?.trim() || "AUTO_FROM_TASK_OR_PRJ_DEFAULT";
    const requestedUpstream = input.upstreamUrl?.trim() || "AUTO_FROM_RUNTIME_PORT";

    return {
      task: {
        title:
          requestedFqdn === "AUTO_FROM_TASK_OR_PRJ_DEFAULT"
            ? "Prefab: DomNex domain provisioning via Codex runtime flow"
            : `Prefab: DomNex domain provisioning (${requestedFqdn})`,
        istState:
          [
            "Port and runtime endpoint are unknown initially. Domain provisioning must not run before the application is reachable.",
            `Requested FQDN: ${requestedFqdn}`,
            `Requested Upstream: ${requestedUpstream}`,
          ].join(" "),
        sollState:
          "Codex determines a free port, installs persistent autostart service (systemd or equivalent), validates external reachability, then calls DomNex API to create the host.",
        technicalPlan:
          [
            "1) Detect a free port on target runtime (no fixed default assumption).",
            "2) Configure and enable persistent autostart runtime (systemd or equivalent) on 0.0.0.0:<FREE_PORT>.",
            "3) Verify service stays active after restart and health endpoint responds.",
            `4) Build upstream URL dynamically from detected port (requested: ${requestedUpstream}).`,
            `5) Use requested fqdn if provided (${requestedFqdn}); otherwise derive from active task text or prj-<id> default-domain.`,
            "6) Use DOMNEX_BASE_URL and DOMNEX_API_TOKEN from runtime env to call DomNex API directly.",
            "7) Call preflight first, create host only when preflight.ready=true.",
            "8) Write resulting fqdn/upstream/host id back to COPM project+documentation.",
            "9) No COPM-level helper script for provisioning logic: execution happens inside Codex workspace flow.",
          ].join(" "),
        riskImpact: "Medium",
      },
      docName: "Prefab Guide - DomNex Provisioning",
      docContent: [
        "# Prefab Guide - DomNex Provisioning",
        "",
        "## Goal",
        "- Codex executes provisioning in the correct order: runtime first, DomNex create second.",
        "",
        "## Inputs (Runtime-resolved)",
        `- Requested FQDN: ${requestedFqdn}`,
        `- Requested Upstream URL: ${requestedUpstream}`,
        "- DOMNEX_BASE_URL: provided via worker runtime env",
        "- DOMNEX_API_TOKEN: provided via worker runtime env",
        "",
        "## Mandatory Sequence",
        "1. Discover free port on target host.",
        "2. Configure persistent autostart service (systemd or equivalent) on 0.0.0.0:<free-port>.",
        "3. Validate service remains active and app is reachable from server/LAN.",
        "4. Call DomNex preflight endpoint.",
        "5. Call DomNex create endpoint only if preflight is ready.",
        "6. Sync result back to COPM.",
        "",
        "## DomNex API Handling (from Codex flow, no COPM script)",
        "- GET ${DOMNEX_BASE_URL}/api/v1/me (auth sanity check)",
        "- POST ${DOMNEX_BASE_URL}/api/v1/hosts/preflight",
        "- POST ${DOMNEX_BASE_URL}/api/v1/hosts",
        "",
        "## Notes",
        "- If preflight says upstream not reachable, keep task ACTIVE and fix runtime/network first.",
        "- Do not create host before runtime is reachable and persistent (autostart).",
      ].join("\n"),
    };
  }

  if (taskType === "DOMNEX_TEARDOWN") {
    return {
      task: {
        title: "Prefab: Full Teardown (DomNex + Workspace + Documentation)",
        istState:
          "Teardown currently does not guarantee cleanup of domain routing, workspace files, and COPM project documentation in one flow.",
        sollState:
          "Single teardown flow removes DomNex host, clears local project workspace, and removes project documentation while keeping tasks for audit trail.",
        technicalPlan:
          "1) Trigger teardown endpoint with clearDocumentation=true and clearWorkspace=true. 2) Validate host deletion (if present). 3) Verify project provisioning state DISABLED and no dangling host id. 4) Verify documentation list is empty while tasks remain untouched.",
        riskImpact: "High",
      },
      docName: "Prefab Guide - DomNex Teardown",
      docContent: [
        "# Prefab Guide - DomNex Teardown",
        "",
        "## Execution",
        "- Use /api/v1/admin/projects/:id/domnex/teardown with payload:",
        "```json",
        "{",
        '  "clearFqdn": true,',
        '  "clearDocumentation": true,',
        '  "clearWorkspace": true',
        "}",
        "```",
        "- Expected result:",
        "- DomNex host/subdomain removed",
        "- Local workspace folder removed",
        "- COPM documentation entries removed",
        "- Tasks remain as historical execution log",
      ].join("\n"),
    };
  }

  const repoUrl = ensureRepoUrl(input.repoUrl);
  return {
    task: {
      title: "Prefab: GitHub push and release delivery",
      istState: "Project has no standardized GitHub push/release delivery flow.",
      sollState: "Project can perform reproducible push and optional release with managed adapter credentials.",
      technicalPlan: `1) Validate GitHub adapter credentials. 2) Set repo remote to ${repoUrl}. 3) Commit/push release branch. 4) Create release/tag with changelog.`,
      riskImpact: "High",
    },
    docName: "Prefab Guide - GitHub Delivery",
    docContent: [
      "# Prefab Guide - GitHub Delivery",
      "",
      "## Required Inputs",
      `- Repo URL: ${repoUrl}`,
      "",
      "## Credentials",
      "- Use project-owner GitHub runtime values (token, username, email).",
      "- Do not persist credential values in task/doc content.",
      "",
      "## Delivery",
      "- Push project state to configured repository.",
      "- Optional: tag and release with generated notes.",
    ].join("\n"),
  };
}

export async function applyPrefabToProject(input: ApplyPrefabInput): Promise<{
  taskId: string;
  documentationId: string | null;
  type: PrefabType;
  teardownExecuted?: boolean;
}> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  if (input.type === "GITHUB_RELEASE") {
    const github = await getGitHubRuntimeSecretsForProject(input.projectId);
    if (!github.enabled || !github.apiToken || !github.username || !github.email) {
      throw new ValidationError(
        "GitHub credentials for the project owner must be fully configured (enabled + token + username + email) before applying GITHUB_RELEASE prefab",
      );
    }
  }

  const prefab = buildPrefab(input.type, {
    repoUrl: input.repoUrl,
    fqdn: input.fqdn,
    upstreamUrl: input.upstreamUrl,
  });

  const created = await prisma.$transaction(async (tx) => {
    const maxOrder = await tx.task.aggregate({
      where: { projectId: input.projectId },
      _max: { executionOrder: true },
    });

    const task = await tx.task.create({
      data: {
        projectId: input.projectId,
        title: prefab.task.title,
        executionOrder: input.executionOrder ?? (maxOrder._max.executionOrder ?? 0) + 1,
        status: "ACTIVE",
        istState: prefab.task.istState,
        sollState: prefab.task.sollState,
        technicalPlan: prefab.task.technicalPlan,
        riskImpact: prefab.task.riskImpact,
      },
      select: { id: true },
    });

    const latestDoc = await tx.documentation.findFirst({
      where: { projectId: input.projectId, name: prefab.docName },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const doc = await tx.documentation.create({
      data: {
        projectId: input.projectId,
        name: prefab.docName,
        version: (latestDoc?.version ?? 0) + 1,
        content: prefab.docContent,
      },
      select: { id: true },
    });

    await tx.project.update({
      where: { id: input.projectId },
      data: { updatedAt: new Date() },
    });

    return {
      taskId: task.id,
      documentationId: doc.id,
      type: input.type,
    };
  });

  if (input.type === "DOMNEX_TEARDOWN") {
    await teardownDomNexProject({
      projectId: input.projectId,
      clearFqdn: true,
      clearDocumentation: true,
      clearWorkspace: true,
      reason: "prefab-teardown",
      initiatedBy: "prefab",
    });
    return {
      ...created,
      documentationId: null,
      teardownExecuted: true,
    };
  }

  return created;
}
