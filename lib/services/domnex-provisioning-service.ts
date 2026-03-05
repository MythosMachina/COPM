import { ValidationError } from "@/lib/api/errors";
import fs from "node:fs/promises";
import path from "node:path";
import { DomNexClient } from "@/lib/integrations/domnex-client";
import { prisma } from "@/lib/prisma";
import { resetAgentProject } from "@/lib/services/agent-run-service";
import { getDomNexAdapterRuntimeSecrets } from "@/lib/services/domnex-adapter-service";

export type ProvisionInput = {
  fqdn?: string;
  upstreamUrl: string;
  insecureTls?: boolean;
  haEnabled?: boolean;
  force?: boolean;
};

type TeardownInput = {
  projectId: string;
  clearFqdn?: boolean;
  clearDocumentation?: boolean;
  clearWorkspace?: boolean;
  reason?: string;
  initiatedBy?: string;
};

function parseFqdn(fqdn: string): { domain: string; subdomain: string } {
  const value = fqdn.trim().toLowerCase();
  const parts = value.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw new ValidationError("fqdn must include domain and subdomain");
  }

  const subdomain = parts.shift() as string;
  const domain = parts.join(".");
  return { domain, subdomain };
}

function extractFqdnCandidates(text: string): string[] {
  const values: string[] = [];

  const urlPattern = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    const host = urlMatch[1]?.toLowerCase().trim();
    if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
      values.push(host);
    }
  }

  const fqdnPattern = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
  let fqdnMatch: RegExpExecArray | null;
  while ((fqdnMatch = fqdnPattern.exec(text)) !== null) {
    const host = fqdnMatch[1]?.toLowerCase().trim();
    if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
      values.push(host);
    }
  }

  return values;
}

async function resolveProvisionFqdn(projectId: string, explicitFqdn?: string): Promise<{ fqdn: string; source: string }> {
  if (explicitFqdn && explicitFqdn.trim()) {
    return { fqdn: explicitFqdn.trim().toLowerCase(), source: "INPUT" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      visualId: true,
      createdBy: {
        select: {
          role: true,
          domainAccess: {
            select: { domain: true },
            orderBy: { domain: "asc" },
          },
        },
      },
    },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  const tasks = await prisma.task.findMany({
    where: { projectId, status: "ACTIVE" },
    orderBy: [{ executionOrder: "asc" }],
    select: {
      visualId: true,
      title: true,
      istState: true,
      sollState: true,
      technicalPlan: true,
      riskImpact: true,
    },
    take: 30,
  });

  for (const task of tasks) {
    const text = [task.title, task.istState, task.sollState, task.technicalPlan, task.riskImpact].join("\n");
    const candidates = extractFqdnCandidates(text);
    if (candidates.length > 0) {
      return { fqdn: candidates[0] as string, source: `TASK:${task.visualId}` };
    }
  }

  const adapter = await prisma.domNexAdapterConfig.findFirst({
    select: { defaultDomain: true },
  });
  const defaultDomain = adapter?.defaultDomain?.trim().toLowerCase();
  if (!defaultDomain) {
    throw new ValidationError(
      "No FQDN found in tasks and DomNex defaultDomain is not configured. Configure defaultDomain or include FQDN in task text.",
    );
  }

  const preferredDomain =
    project.createdBy.role === "ADMIN"
      ? defaultDomain
      : project.createdBy.domainAccess[0]?.domain?.trim().toLowerCase() || defaultDomain;

  return {
    fqdn: `${project.visualId.toLowerCase()}.${preferredDomain}`,
    source:
      project.createdBy.role === "ADMIN" || !project.createdBy.domainAccess[0]?.domain
        ? "DEFAULT:PROJECT_VISUAL_ID"
        : "DEFAULT:OWNER_ALLOWED_APEX",
  };
}

async function assertOwnerCanUseApexDomain(projectId: string, domain: string): Promise<void> {
  const normalizedDomain = domain.trim().toLowerCase();
  const [project, activeApexDomains] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        createdBy: {
          select: {
            role: true,
            domainAccess: {
              select: { domain: true },
            },
          },
        },
      },
    }),
    prisma.domNexApexDomain.findMany({
      select: { domain: true },
    }),
  ]);

  if (!project) {
    throw new ValidationError("Project not found");
  }

  const activeDomains = new Set(activeApexDomains.map((entry) => entry.domain.trim().toLowerCase()));
  if (!activeDomains.has(normalizedDomain)) {
    throw new ValidationError(`Apex domain '${normalizedDomain}' is not active in global DomNex configuration.`);
  }

  if (project.createdBy.role === "ADMIN") {
    return;
  }

  const allowedDomains = new Set(project.createdBy.domainAccess.map((entry) => entry.domain.trim().toLowerCase()));
  if (!allowedDomains.has(normalizedDomain)) {
    throw new ValidationError(
      `Project owner is not allowed to create subdomains under apex domain '${normalizedDomain}'.`,
    );
  }
}

function buildPreflightFailureMessage(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return "DomNex preflight did not return ready=true";
  }

  const obj = raw as Record<string, unknown>;
  if (obj.upstream_reachable === false) {
    return "Blocker: DomNex preflight upstream_reachable=false for all tested upstream endpoints.";
  }

  const checks = obj.checks;
  if (Array.isArray(checks)) {
    const failedChecks = checks
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const check = entry as Record<string, unknown>;
        const ok = check.ok;
        const key = String(check.key ?? check.name ?? "").trim();
        const detail = String(check.message ?? check.reason ?? check.error ?? "").trim();
        if (ok === false) {
          if (key === "upstream_reachable") {
            return "upstream_reachable=false";
          }
          if (key && detail) {
            return `${key}: ${detail}`;
          }
          return key || detail || "unknown check failed";
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
    if (failedChecks.length > 0) {
      return `Blocker: DomNex preflight checks failed (${failedChecks.join("; ")})`;
    }
  }

  if (checks && typeof checks === "object") {
    const checkObj = checks as Record<string, unknown>;
    if (checkObj.upstream_reachable === false) {
      return "Blocker: DomNex preflight upstream_reachable=false for all tested upstream endpoints.";
    }
  }

  const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
  const message = typeof obj.message === "string" ? obj.message.trim() : "";
  const error = typeof obj.error === "string" ? obj.error.trim() : "";
  const errors =
    Array.isArray(obj.errors) && obj.errors.length > 0
      ? obj.errors.map((entry) => String(entry)).join("; ")
      : "";

  const detail = [reason, message, error, errors].find((value) => Boolean(value));
  if (!detail) {
    return "DomNex preflight did not return ready=true";
  }

  return `DomNex preflight rejected request: ${detail}`;
}

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function validateProvisionUpstreamUrl(upstreamUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(upstreamUrl);
  } catch {
    throw new ValidationError("upstreamUrl must be a valid absolute URL");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
    throw new ValidationError(
      "upstreamUrl uses localhost/loopback, which is not reachable from remote DomNex servers. Use LAN/FQDN host instead.",
    );
  }
}

async function assertUpstreamReachableBeforeProvisioning(upstreamUrl: string): Promise<void> {
  const probe = async (method: "HEAD" | "GET") => {
    const response = await fetch(upstreamUrl, {
      method,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return response.status >= 200 && response.status < 500;
  };

  try {
    if (await probe("HEAD")) {
      return;
    }
  } catch {
    // Fallback to GET below.
  }

  try {
    if (await probe("GET")) {
      return;
    }
  } catch {
    // handled below
  }

  throw new ValidationError(
    "Upstream gate failed: application is not reachable yet. Provisioning requires a persistent externally reachable service (systemd/autostart or equivalent) before DomNex preflight.",
  );
}

async function appendProvisionReport(projectId: string, content: string) {
  const latest = await prisma.documentation.findFirst({
    where: { projectId, name: "DOMNEX:PROVISION:REPORT" },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.documentation.create({
    data: {
      projectId,
      name: "DOMNEX:PROVISION:REPORT",
      version: (latest?.version ?? 0) + 1,
      content,
    },
  });
}

async function appendTeardownReport(projectId: string, content: string) {
  const latest = await prisma.documentation.findFirst({
    where: { projectId, name: "DOMNEX:TEARDOWN:REPORT" },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.documentation.create({
    data: {
      projectId,
      name: "DOMNEX:TEARDOWN:REPORT",
      version: (latest?.version ?? 0) + 1,
      content,
    },
  });
}

export async function queueDomNexProvisionForProject(projectId: string, input: ProvisionInput) {
  validateProvisionUpstreamUrl(input.upstreamUrl);
  await assertUpstreamReachableBeforeProvisioning(input.upstreamUrl);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, visualId: true, name: true },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  const resolved = await resolveProvisionFqdn(projectId, input.fqdn);
  const { domain, subdomain } = parseFqdn(resolved.fqdn);
  await assertOwnerCanUseApexDomain(projectId, domain);
  const fqdn = `${subdomain}.${domain}`;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      autoProvisionDomain: true,
      fqdn,
      provisionUpstreamUrl: input.upstreamUrl,
      provisionInsecureTls: input.insecureTls ?? false,
      provisionHaEnabled: input.haEnabled ?? false,
      provisionStatus: "PENDING",
      provisionError: null,
      ...(input.force ? { domnexHostId: null, provisionedAt: null } : {}),
    },
  });

  await appendProvisionReport(
    projectId,
    [
      "# DomNex Provisioning Queue",
      "",
      `- Project: ${project.name} (${project.visualId})`,
      `- FQDN: ${fqdn}`,
      `- FQDN Source: ${resolved.source}`,
      `- Upstream: ${input.upstreamUrl}`,
      `- QueuedAt: ${new Date().toISOString()}`,
      `- Force: ${Boolean(input.force)}`,
      "",
      "Status moved to PENDING. Worker will execute asynchronously.",
    ].join("\n"),
  );

  return {
    queued: true,
    projectId,
    fqdn,
    upstreamUrl: input.upstreamUrl,
    status: "PENDING" as const,
  };
}

async function runProvisioning(projectId: string, input: ProvisionInput) {
  validateProvisionUpstreamUrl(input.upstreamUrl);
  await assertUpstreamReachableBeforeProvisioning(input.upstreamUrl);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, visualId: true, name: true },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  const runtime = await getDomNexAdapterRuntimeSecrets();
  if (!runtime.enabled || !runtime.baseUrl || !runtime.apiToken) {
    throw new ValidationError("DomNex adapter is disabled or missing runtime secrets");
  }

  const resolved = await resolveProvisionFqdn(projectId, input.fqdn);
  const { domain, subdomain } = parseFqdn(resolved.fqdn);
  await assertOwnerCanUseApexDomain(projectId, domain);
  const fqdn = `${subdomain}.${domain}`;
  const client = new DomNexClient(runtime.baseUrl, runtime.apiToken);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      autoProvisionDomain: true,
      provisionStatus: "RUNNING",
      provisionError: null,
      fqdn,
      provisionUpstreamUrl: input.upstreamUrl,
      provisionInsecureTls: input.insecureTls ?? false,
      provisionHaEnabled: input.haEnabled ?? false,
    },
  });

  const reportLines: string[] = [];
  reportLines.push("# DomNex Provisioning Report");
  reportLines.push("");
  reportLines.push(`- Project: ${project.name} (${project.visualId})`);
  reportLines.push(`- FQDN: ${fqdn}`);
  reportLines.push(`- FQDN Source: ${resolved.source}`);
  reportLines.push(`- Upstream: ${input.upstreamUrl}`);
  reportLines.push(`- Base URL: ${runtime.baseUrl}`);
  reportLines.push(`- Timestamp: ${new Date().toISOString()}`);
  reportLines.push("");

  try {
    await client.getMe();
    reportLines.push("## Auth check");
    reportLines.push("- OK");

    if (!input.force) {
      const existing = await client.findHostByFqdn(fqdn);
      if (existing) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            autoProvisionDomain: true,
            provisionStatus: "READY",
            provisionError: null,
            domnexHostId: existing.id,
            fqdn: existing.fqdn,
            provisionedAt: new Date(),
          },
        });

        reportLines.push("");
        reportLines.push("## Idempotent result");
        reportLines.push(`- Existing host reused: ${existing.id}`);
        reportLines.push(`- Existing upstream: ${existing.upstream || "n/a"}`);

        await appendProvisionReport(projectId, reportLines.join("\n"));

        return {
          mode: "REUSED" as const,
          hostId: existing.id,
          fqdn: existing.fqdn,
          upstream: existing.upstream,
        };
      }
    }

    const preflight = await client.preflightHost({
      domain,
      subdomain,
      upstream: input.upstreamUrl,
      insecureTls: input.insecureTls,
      haEnabled: input.haEnabled,
    });

    reportLines.push("");
    reportLines.push("## Preflight");
    reportLines.push(`- ready: ${preflight.ready}`);

    if (!preflight.ready) {
      reportLines.push(`- payload: ${stringifyUnknown(preflight.raw).slice(0, 2000)}`);
      throw new ValidationError(buildPreflightFailureMessage(preflight.raw), preflight.raw);
    }

    const created = await client.createHost({
      domain,
      subdomain,
      upstream: input.upstreamUrl,
      insecureTls: input.insecureTls,
      haEnabled: input.haEnabled,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        autoProvisionDomain: true,
        provisionStatus: "READY",
        provisionError: null,
        domnexHostId: created.id,
        fqdn: created.fqdn,
        provisionedAt: new Date(),
      },
    });

    reportLines.push("");
    reportLines.push("## Create host");
    reportLines.push(`- Created host id: ${created.id}`);

    await appendProvisionReport(projectId, reportLines.join("\n"));

    return {
      mode: "CREATED" as const,
      hostId: created.id,
      fqdn: created.fqdn,
      upstream: created.upstream,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        provisionStatus: "FAILED",
        provisionError: message,
      },
    });

    reportLines.push("");
    reportLines.push("## Failed");
    reportLines.push(`- Error: ${message}`);

    await appendProvisionReport(projectId, reportLines.join("\n"));
    throw error;
  }
}

export async function processPendingDomNexProvisioning(limit = 3): Promise<{
  scanned: number;
  processed: number;
  failed: number;
}> {
  const pending = await prisma.project.findMany({
    where: {
      autoProvisionDomain: true,
      provisionStatus: "PENDING",
      fqdn: { not: null },
      provisionUpstreamUrl: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      fqdn: true,
      provisionUpstreamUrl: true,
      provisionInsecureTls: true,
      provisionHaEnabled: true,
    },
  });

  let processed = 0;
  let failed = 0;

  for (const project of pending) {
    try {
      await runProvisioning(project.id, {
        fqdn: project.fqdn ?? "",
        upstreamUrl: project.provisionUpstreamUrl ?? "",
        insecureTls: project.provisionInsecureTls,
        haEnabled: project.provisionHaEnabled,
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.project.update({
        where: { id: project.id },
        data: {
          provisionStatus: "FAILED",
          provisionError: message,
        },
      });
      failed += 1;
    }
  }

  return {
    scanned: pending.length,
    processed,
    failed,
  };
}

export async function setProjectDomNexAutoProvision(projectId: string, enabled: boolean) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, visualId: true, autoProvisionDomain: true, provisionStatus: true },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  const nextStatus = enabled
    ? (project.provisionStatus === "DISABLED" ? "PENDING" : project.provisionStatus)
    : "DISABLED";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      autoProvisionDomain: enabled,
      provisionStatus: nextStatus,
      provisionError: null,
    },
  });

  await appendProvisionReport(
    projectId,
    [
      "# DomNex Provisioning Toggle",
      "",
      `- Project: ${project.visualId}`,
      `- Enabled: ${enabled}`,
      `- Timestamp: ${new Date().toISOString()}`,
    ].join("\n"),
  );

  return {
    projectId,
    autoProvisionDomain: enabled,
    provisionStatus: nextStatus,
  };
}

export async function teardownDomNexProject(input: TeardownInput): Promise<{
  projectId: string;
  deleted: boolean;
  hostId: string | null;
  deletedDocumentationCount: number;
  workspaceCleared: boolean;
  status: "DISABLED" | "FAILED";
}> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      visualId: true,
      name: true,
      fqdn: true,
      domnexHostId: true,
      provisionStatus: true,
      autoProvisionDomain: true,
    },
  });
  if (!project) {
    throw new ValidationError("Project not found");
  }

  const reportLines: string[] = [];
  reportLines.push("# DomNex Teardown Report");
  reportLines.push("");
  reportLines.push(`- Project: ${project.name} (${project.visualId})`);
  reportLines.push(`- Reason: ${input.reason ?? "manual"}`);
  reportLines.push(`- InitiatedBy: ${input.initiatedBy ?? "system"}`);
  reportLines.push(`- Timestamp: ${new Date().toISOString()}`);
  reportLines.push(`- Current Status: ${project.provisionStatus}`);
  reportLines.push(`- FQDN: ${project.fqdn ?? "n/a"}`);
  reportLines.push(`- HostId: ${project.domnexHostId ?? "n/a"}`);

  let deleted = false;
  let resolvedHostId: string | null = project.domnexHostId ?? null;
  let deletedDocumentationCount = 0;
  let workspaceCleared = false;
  let agentReset: { canceledRuns: number; killedPids: number; resolvedQuestions: number } | null = null;
  try {
    if (input.clearWorkspace || input.clearDocumentation) {
      agentReset = await resetAgentProject(project.id);
    }

    if (project.domnexHostId || project.fqdn) {
      const runtime = await getDomNexAdapterRuntimeSecrets();
      if (!runtime.enabled || !runtime.baseUrl || !runtime.apiToken) {
        throw new ValidationError("DomNex adapter is disabled or missing runtime secrets");
      }
      const client = new DomNexClient(runtime.baseUrl, runtime.apiToken);

      if (project.domnexHostId) {
        await client.deleteHostById(project.domnexHostId);
        deleted = true;
        reportLines.push("");
        reportLines.push("## Delete host");
        reportLines.push(`- Deleted by host id: ${project.domnexHostId}`);
      } else if (project.fqdn) {
        const result = await client.deleteHostByFqdn(project.fqdn);
        deleted = result.deleted;
        resolvedHostId = result.hostId ?? null;
        reportLines.push("");
        reportLines.push("## Delete host");
        reportLines.push(
          result.deleted
            ? `- Deleted by fqdn lookup: ${project.fqdn} (${result.hostId})`
            : `- No host found for fqdn lookup: ${project.fqdn}`,
        );
      }
    } else {
      reportLines.push("");
      reportLines.push("## Delete host");
      reportLines.push("- Skipped: project has no domnexHostId/fqdn");
    }

    await prisma.project.update({
      where: { id: project.id },
      data: {
        autonomousAgentEnabled: input.clearWorkspace || input.clearDocumentation ? false : undefined,
        autoProvisionDomain: false,
        provisionStatus: "DISABLED",
        provisionError: null,
        domnexHostId: null,
        ...(input.clearFqdn ? { fqdn: null } : {}),
      },
    });

    if (input.clearDocumentation) {
      const deletedDocs = await prisma.documentation.deleteMany({
        where: { projectId: project.id },
      });
      deletedDocumentationCount = deletedDocs.count;
    }

    if (input.clearWorkspace) {
      const workspaceRoot = process.env.COPM_AGENT_WORKSPACE_ROOT?.trim() || path.resolve(process.cwd(), "workspaces");
      const workspacePath = path.join(workspaceRoot, project.visualId);
      await fs.rm(workspacePath, { recursive: true, force: true });
      workspaceCleared = true;
    }

    reportLines.push("");
    reportLines.push("## Result");
    reportLines.push("- Status moved to DISABLED");
    reportLines.push(`- Deleted: ${deleted}`);
    reportLines.push(`- Deleted documentation entries: ${deletedDocumentationCount}`);
    reportLines.push(`- Workspace cleared: ${workspaceCleared}`);
    if (agentReset) {
      reportLines.push(`- Agent reset: canceledRuns=${agentReset.canceledRuns}, killedPids=${agentReset.killedPids}`);
    }
    if (!input.clearDocumentation) {
      await appendTeardownReport(project.id, reportLines.join("\n"));
    }

    return {
      projectId: project.id,
      deleted,
      hostId: resolvedHostId,
      deletedDocumentationCount,
      workspaceCleared,
      status: "DISABLED",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.project.update({
      where: { id: project.id },
      data: {
        provisionStatus: "FAILED",
        provisionError: message,
      },
    });

    reportLines.push("");
    reportLines.push("## Failed");
    reportLines.push(`- Error: ${message}`);
    await appendTeardownReport(project.id, reportLines.join("\n"));
    throw error;
  }
}
