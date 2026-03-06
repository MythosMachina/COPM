"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentLiveStreamModal } from "@/components/admin/agent-live-stream-modal";
import type { DocumentationDTO, LifecycleRunDTO, LifecycleRunDetailDTO } from "@/types/domain";

type LifecycleManagerProps = {
  projectId: string;
  runs: LifecycleRunDTO[];
  activeRun: LifecycleRunDetailDTO | null;
  draftRun: LifecycleRunDetailDTO | null;
  docs?: DocumentationDTO[];
  showRunBuilder?: boolean;
};

type AgentRunState = {
  status: "IDLE" | "QUEUED" | "RUNNING" | "WAITING_INPUT" | "DONE" | "FAILED" | "CANCELED";
  runId: string | null;
  updatedAt: string | null;
  failureReason: string | null;
  codexStatusSnapshot: string[];
};

type MaintenanceDraft = {
  moduleType: "CHANGE" | "FIX" | "TEARDOWN";
  title: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

type ModuleEditDraft = {
  moduleType: "TECHSTACK" | "FEATURE" | "CHECK" | "DOMAIN" | "DEPLOY" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "CUSTOM";
  title: string;
  description: string;
  expectedState: string;
  gateRequired: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

const birthTemplate = [
  {
    moduleOrder: 1,
    moduleType: "TECHSTACK",
    title: "Techstack Foundation",
    description: "Define runtime, scaffold, dependencies and base folder structure.",
    expectedState: "Core runtime scaffold is production-ready.",
    riskLevel: "MEDIUM",
  },
  {
    moduleOrder: 2,
    moduleType: "FEATURE",
    title: "Feature Module",
    description: "Implement API/UI/Auth/Logging/Monitoring scope as required.",
    expectedState: "Feature set for release scope is implemented.",
    riskLevel: "MEDIUM",
  },
  {
    moduleOrder: 3,
    moduleType: "CHECK",
    title: "Quality Gate",
    description: "Lint, build, runtime test and health validation.",
    expectedState: "Quality gate is green and validated.",
    gateRequired: true,
    riskLevel: "HIGH",
  },
  {
    moduleOrder: 4,
    moduleType: "DOMAIN",
    title: "Domain Provisioning",
    description: "Subdomain, DNS, edge and certificate preflight.",
    expectedState: "Domain points to healthy runtime endpoint.",
    riskLevel: "HIGH",
  },
  {
    moduleOrder: 5,
    moduleType: "DEPLOY",
    title: "Deploy and Verify",
    description: "Deploy, run runtime checks, snapshot and docs sync.",
    expectedState: "Deployment validated with evidence and rollback snapshot.",
    riskLevel: "HIGH",
  },
];

const techstackPresets = [
  { id: "node-next", label: "Node.js + Next.js", runtime: "nodejs", framework: "nextjs", packageManager: "npm", language: "typescript" },
  { id: "python-fastapi", label: "Python + FastAPI", runtime: "python", framework: "fastapi", packageManager: "pip", language: "python" },
  { id: "php-laravel", label: "PHP + Laravel", runtime: "php", framework: "laravel", packageManager: "composer", language: "php" },
  { id: "go-fiber", label: "Go + Fiber", runtime: "go", framework: "fiber", packageManager: "go-mod", language: "go" },
  { id: "java-spring", label: "Java + Spring Boot", runtime: "java", framework: "spring-boot", packageManager: "maven", language: "java" },
  { id: "rust-axum", label: "Rust + Axum", runtime: "rust", framework: "axum", packageManager: "cargo", language: "rust" },
] as const;

type ParsedPrephaseReview = {
  titleRewrite: string;
  descriptionRewrite: string;
  additions: string[];
  risks: string[];
  readyForBuild: string;
  missingBeforeBuild: string[];
};

function parseNumberedLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function extractSection(content: string, startLabel: string, endLabels: string[]): string {
  const start = content.indexOf(startLabel);
  if (start === -1) {
    return "";
  }
  const from = start + startLabel.length;
  const endPositions = endLabels
    .map((label) => content.indexOf(label, from))
    .filter((pos) => pos !== -1)
    .sort((a, b) => a - b);
  const end = endPositions[0] ?? content.length;
  return content.slice(from, end).trim();
}

function parsePrephaseReview(content: string): ParsedPrephaseReview | null {
  const titleRewrite = extractSection(content, "Title rewrite:", [
    "Description rewrite:",
    "Additions:",
    "Risks:",
    "Ready for build:",
  ]).replace(/^`|`$/g, "");
  const descriptionRewrite = extractSection(content, "Description rewrite:", [
    "Additions:",
    "Risks:",
    "Ready for build:",
  ]).replace(/^`|`$/g, "");
  const additionsBlock = extractSection(content, "Additions:", ["Risks:", "Ready for build:"]);
  const risksBlock = extractSection(content, "Risks:", ["Ready for build:"]);
  const readyForBuild = extractSection(content, "Ready for build:", ["Missing before build:"]);
  const missingBlock = extractSection(content, "Missing before build:", []);

  const additions = parseNumberedLines(additionsBlock);
  const risks = parseNumberedLines(risksBlock);
  const missingBeforeBuild = parseNumberedLines(missingBlock);

  if (!titleRewrite && !descriptionRewrite && additions.length === 0 && risks.length === 0) {
    return null;
  }

  return {
    titleRewrite: titleRewrite || "-",
    descriptionRewrite: descriptionRewrite || "-",
    additions,
    risks,
    readyForBuild: readyForBuild || "UNKNOWN",
    missingBeforeBuild,
  };
}

function withTechstackPreset(presetId: string): unknown[] {
  const preset = techstackPresets.find((item) => item.id === presetId) ?? techstackPresets[0];
  return birthTemplate.map((module) => {
    if (module.moduleType !== "TECHSTACK") {
      return module;
    }
    return {
      ...module,
      description: `Define runtime and scaffold baseline with ${preset.label}.`,
      config: {
        presetId: preset.id,
        runtime: preset.runtime,
        framework: preset.framework,
        packageManager: preset.packageManager,
        language: preset.language,
      },
    };
  });
}

function detectTechstackPresetId(run: LifecycleRunDetailDTO | null): string {
  if (!run) {
    return techstackPresets[0].id;
  }
  const techstackModule = run.modules.find((module) => module.moduleType === "TECHSTACK");
  const config =
    techstackModule && techstackModule.config && typeof techstackModule.config === "object"
      ? (techstackModule.config as Record<string, unknown>)
      : null;
  const presetId = typeof config?.presetId === "string" ? config.presetId : "";
  return techstackPresets.some((preset) => preset.id === presetId) ? presetId : techstackPresets[0].id;
}

function extractCodexStatusSnapshot(summary: string | null | undefined): string[] {
  if (!summary) {
    return [];
  }
  const lines = summary.replace(/\r/g, "").split("\n");
  const startIndex = lines.findIndex((line) => line.includes("[COPM] Codex status snapshot at run start"));
  if (startIndex === -1) {
    return [];
  }
  const snapshotLines: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (index > startIndex && line.startsWith("[COPM]") && !line.startsWith("[COPM][CODEX_STATUS]")) {
      break;
    }
    if (line.startsWith("[COPM] Codex status snapshot at run start") || line.startsWith("[COPM][CODEX_STATUS]")) {
      snapshotLines.push(line);
    }
  }
  return snapshotLines.slice(0, 20);
}

function buildModulesDraft(run: LifecycleRunDetailDTO | null, fallbackPresetId: string): unknown[] {
  if (!run || run.modules.length === 0) {
    return withTechstackPreset(fallbackPresetId);
  }
  return [...run.modules]
    .sort((a, b) => a.moduleOrder - b.moduleOrder)
    .map((module) => ({
      moduleOrder: module.moduleOrder,
      moduleType: module.moduleType,
      title: module.title,
      description: module.description,
      config: module.config ?? null,
      expectedState: module.expectedState,
      gateRequired: module.gateRequired,
      completionPolicy: module.completionPolicy,
      riskLevel: module.riskLevel,
    }));
}

export function LifecycleManager({
  projectId,
  runs,
  activeRun,
  draftRun,
  docs = [],
  showRunBuilder = true,
}: LifecycleManagerProps) {
  const router = useRouter();
  const initialPresetId = detectTechstackPresetId(draftRun);
  const [title, setTitle] = useState(draftRun?.run.title ?? "vNext Birth Pipeline");
  const [mode, setMode] = useState<"STEP" | "BATCH">(draftRun?.run.mode ?? "STEP");
  const [techstackPresetId, setTechstackPresetId] = useState<string>(initialPresetId);
  const [autoStart, setAutoStart] = useState(false);
  const [modulesJson, setModulesJson] = useState(JSON.stringify(buildModulesDraft(draftRun, initialPresetId), null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prephaseBusy, setPrephaseBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [runAgentBusy, setRunAgentBusy] = useState(false);
  const [aiCheckModuleId, setAiCheckModuleId] = useState<string>("");
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>({
    moduleType: "CHANGE",
    title: "",
    description: "",
    riskLevel: "MEDIUM",
  });
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceTargetRunId, setMaintenanceTargetRunId] = useState<string>("");
  const [editingModuleId, setEditingModuleId] = useState<string>("");
  const [editDraft, setEditDraft] = useState<ModuleEditDraft | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [agentState, setAgentState] = useState<AgentRunState>({
    status: "IDLE",
    runId: null,
    updatedAt: null,
    failureReason: null,
    codexStatusSnapshot: [],
  });
  const [agentStateBusy, setAgentStateBusy] = useState(false);

  const sortedRuns = useMemo(() => runs, [runs]);
  const isMaintenanceEligible = (run: Pick<LifecycleRunDTO, "status" | "classification">) =>
    run.status === "DEPLOYED" || run.classification === "DEPLOYED";
  const deployedRun = useMemo(
    () => sortedRuns.find((entry) => isMaintenanceEligible(entry)) ?? null,
    [sortedRuns],
  );
  const maintenanceRunId =
    activeRun && isMaintenanceEligible(activeRun.run) ? activeRun.run.id : deployedRun?.id ?? "";
  const activeModules = useMemo(
    () => (activeRun ? activeRun.modules.filter((module) => module.status !== "COMPLETED") : []),
    [activeRun],
  );
  const archivedModules = useMemo(
    () => (activeRun ? activeRun.modules.filter((module) => module.status === "COMPLETED") : []),
    [activeRun],
  );
  const aiCheckDocsByModule = useMemo(() => {
    const map = new Map<string, DocumentationDTO[]>();
    for (const doc of docs) {
      if (!doc.name.startsWith("MODULE:AI_CHECK:")) {
        continue;
      }
      const parts = doc.name.split(":");
      const moduleId = parts[3];
      if (!moduleId) {
        continue;
      }
      const existing = map.get(moduleId) ?? [];
      existing.push(doc);
      map.set(moduleId, existing);
    }

    for (const entries of map.values()) {
      entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return map;
  }, [docs]);
  const localBusy =
    busy ||
    prephaseBusy ||
    startBusy ||
    runAgentBusy ||
    Boolean(aiCheckModuleId) ||
    editBusy ||
    maintenanceBusy;
  const agentIsActive = agentState.status === "QUEUED" || agentState.status === "RUNNING";
  const controlsDisabled = localBusy || agentIsActive;

  function startEditModule(module: LifecycleRunDetailDTO["modules"][number]) {
    setEditingModuleId(module.id);
    setEditDraft({
      moduleType: module.moduleType,
      title: module.title,
      description: module.description,
      expectedState: module.expectedState,
      gateRequired: module.gateRequired,
      riskLevel: module.riskLevel,
    });
  }

  function cancelEditModule() {
    setEditingModuleId("");
    setEditDraft(null);
  }

  async function saveEditModule(runId: string, moduleId: string) {
    if (!editDraft) {
      return;
    }
    setEditBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/lifecycle/runs/${runId}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to update module definition");
      }
      cancelEditModule();
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update module definition");
    } finally {
      setEditBusy(false);
    }
  }

  useEffect(() => {
    let canceled = false;

    async function fetchSnapshot(runId: string): Promise<string[]> {
      return await new Promise<string[]>((resolve) => {
        const source = new EventSource(`/api/v1/admin/agent/runs/${runId}/stream`);
        const timer = window.setTimeout(() => {
          source.close();
          resolve([]);
        }, 2200);

        source.addEventListener("init", (event) => {
          const payload = JSON.parse((event as MessageEvent).data) as { tail?: string };
          window.clearTimeout(timer);
          source.close();
          resolve(extractCodexStatusSnapshot(payload.tail ?? ""));
        });

        source.onerror = () => {
          window.clearTimeout(timer);
          source.close();
          resolve([]);
        };
      });
    }

    async function fetchAgentState() {
      try {
        setAgentStateBusy(true);
        const response = await fetch(`/api/v1/admin/agent/runs?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: Array<{
            id: string;
            status: AgentRunState["status"];
            updatedAt: string;
            failureReason: string | null;
            summary: string | null;
          }>;
        };
        if (!response.ok || !payload.success) {
          return;
        }
        const latest = payload.data?.[0];
        if (canceled) {
          return;
        }
        if (!latest) {
          setAgentState({
            status: "IDLE",
            runId: null,
            updatedAt: null,
            failureReason: null,
            codexStatusSnapshot: [],
          });
          return;
        }
        const summarySnapshot = extractCodexStatusSnapshot(latest.summary);
        const liveSnapshot =
          summarySnapshot.length > 0 ? summarySnapshot : await fetchSnapshot(latest.id);
        setAgentState({
          status: latest.status,
          runId: latest.id,
          updatedAt: latest.updatedAt,
          failureReason: latest.failureReason,
          codexStatusSnapshot: liveSnapshot,
        });
      } catch {
        // Keep existing state on polling errors.
      } finally {
        if (!canceled) {
          setAgentStateBusy(false);
        }
      }
    }

    void fetchAgentState();
    const timer = window.setInterval(() => {
      void fetchAgentState();
    }, 5000);

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [projectId]);

  function onPresetChange(nextId: string) {
    setTechstackPresetId(nextId);
    setModulesJson(JSON.stringify(withTechstackPreset(nextId), null, 2));
  }

  async function onCreateRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const modules = JSON.parse(modulesJson) as unknown;
      const response = await fetch(`/api/v1/admin/projects/${projectId}/lifecycle/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          mode,
          classification: "BIRTH",
          autoStart,
          modules,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to create lifecycle run");
      }
      if (showRunBuilder) {
        router.push(`/dashboard/projects/${projectId}/lifecycle`);
      } else {
        router.refresh();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create lifecycle run");
    } finally {
      setBusy(false);
    }
  }

  async function onRunPrephase() {
    setPrephaseBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/admin/agent/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to trigger prephase run");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to trigger prephase run");
    } finally {
      setPrephaseBusy(false);
    }
  }

  async function onStartBuild(runId: string) {
    setStartBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/lifecycle/runs/${runId}/start`, {
        method: "POST",
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to enable Codex run");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to enable Codex run");
    } finally {
      setStartBusy(false);
    }
  }

  async function onRunAgent() {
    setRunAgentBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/agent/run`, {
        method: "POST",
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to trigger agent run");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to trigger agent run");
    } finally {
      setRunAgentBusy(false);
    }
  }

  async function onAiCheck(runId: string, moduleId: string) {
    setAiCheckModuleId(moduleId);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/admin/projects/${projectId}/lifecycle/runs/${runId}/modules/${moduleId}/ai-check`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to run AI check");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to run AI check");
    } finally {
      setAiCheckModuleId("");
    }
  }

  async function onReopenModule(runId: string, moduleId: string) {
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/lifecycle/runs/${runId}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "PENDING",
          evidence: {
            kind: "OPERATOR_REOPEN",
            summary: "Module reopened by operator with escalation review required",
            details: {
              escalationLevel: "HIGH",
              instruction:
                "Module was reopened. Re-validate implementation depth, root-cause and regression coverage before completion.",
              source: "COPM_ADMIN_UI",
            },
          },
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to reopen module");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reopen module");
    }
  }

  async function onAppendMaintenanceModule(runId: string) {
    setMaintenanceBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/lifecycle/runs/${runId}/modules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(maintenanceDraft),
      });
      const payload = (await response.json()) as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to append module");
      }
      setMaintenanceDraft({
        moduleType: "CHANGE",
        title: "",
        description: "",
        riskLevel: "MEDIUM",
      });
      setMaintenanceModalOpen(false);
      setMaintenanceTargetRunId("");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to append module");
    } finally {
      setMaintenanceBusy(false);
    }
  }

  function openMaintenanceModal(runId: string) {
    setMaintenanceTargetRunId(runId);
    setMaintenanceModalOpen(true);
  }

  function renderModuleCard(module: LifecycleRunDetailDTO["modules"][number]) {
    if (!activeRun) {
      return null;
    }

    return (
      <article key={module.id} className="detail-box">
        <div className="detail-head">
          <h4 className="truncate-1" title={module.title}>#{module.moduleOrder} {module.title}</h4>
          <div className="ops-badge-row">
            <span className="status-pill active">{module.status}</span>
            <span className="metric-pill neutral">{module.moduleType}</span>
            <span className="metric-pill docs">Risk {module.riskLevel}</span>
          </div>
        </div>
        <p className="ops-muted truncate-2" title={module.description}>{module.description}</p>
        <p className="ops-subtle truncate-2" title={module.expectedState}>Expected: {module.expectedState}</p>
        <div className="task-actions-inline">
          {editingModuleId === module.id ? (
            <>
              <button disabled={controlsDisabled || editBusy} onClick={() => saveEditModule(activeRun.run.id, module.id)}>
                {editBusy ? "Saving..." : "Save"}
              </button>
              <button disabled={controlsDisabled || editBusy} onClick={cancelEditModule}>Cancel</button>
            </>
          ) : (
            <>
              <button disabled={controlsDisabled} onClick={() => startEditModule(module)}>Edit</button>
              <button
                disabled={controlsDisabled}
                onClick={() => onAiCheck(activeRun.run.id, module.id)}
              >
                {aiCheckModuleId === module.id ? "AI Checking..." : "AI Check"}
              </button>
              {module.status === "COMPLETED" ? (
                <button disabled={controlsDisabled} onClick={() => onReopenModule(activeRun.run.id, module.id)}>
                  Reopen
                </button>
              ) : null}
            </>
          )}
        </div>
        {(() => {
          const linkedDocs = aiCheckDocsByModule.get(module.id) ?? [];
          if (linkedDocs.length === 0) {
            return null;
          }
          return (
            <div className="ops-stack">
              <p className="label">Linked AI Checks</p>
              <ul className="ops-compact-list">
                {linkedDocs.slice(0, 3).map((doc) => (
                  <li key={`module-ai-doc-${module.id}-${doc.id}`}>
                    <a href={`/dashboard/projects/${projectId}/docs/${doc.id}`} className="inline-action">
                      Open AI Check ({new Date(doc.createdAt).toLocaleString("de-DE")})
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {editingModuleId === module.id && editDraft ? (
          <div className="bootstrap-box">
            <label>Type</label>
            <select
              value={editDraft.moduleType}
              onChange={(event) =>
                setEditDraft((current) =>
                  current ? { ...current, moduleType: event.target.value as ModuleEditDraft["moduleType"] } : current,
                )
              }
            >
              <option value="TECHSTACK">TECHSTACK</option>
              <option value="FEATURE">FEATURE</option>
              <option value="CHECK">CHECK</option>
              <option value="DOMAIN">DOMAIN</option>
              <option value="DEPLOY">DEPLOY</option>
              <option value="CHANGE">CHANGE</option>
              <option value="FIX">FIX</option>
              <option value="ITERATE">ITERATE</option>
              <option value="TEARDOWN">TEARDOWN</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>

            <label>Title</label>
            <input
              value={editDraft.title}
              onChange={(event) =>
                setEditDraft((current) => (current ? { ...current, title: event.target.value } : current))
              }
            />

            <label>Description</label>
            <textarea
              rows={3}
              value={editDraft.description}
              onChange={(event) =>
                setEditDraft((current) => (current ? { ...current, description: event.target.value } : current))
              }
            />

            <label>Expected State</label>
            <textarea
              rows={2}
              value={editDraft.expectedState}
              onChange={(event) =>
                setEditDraft((current) => (current ? { ...current, expectedState: event.target.value } : current))
              }
            />

            <label>Risk Level</label>
            <select
              value={editDraft.riskLevel}
              onChange={(event) =>
                setEditDraft((current) =>
                  current ? { ...current, riskLevel: event.target.value as ModuleEditDraft["riskLevel"] } : current,
                )
              }
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editDraft.gateRequired}
                onChange={(event) =>
                  setEditDraft((current) => (current ? { ...current, gateRequired: event.target.checked } : current))
                }
              />
              Gate Required
            </label>
          </div>
        ) : null}
        {module.actualState ? (
          <details className="agent-live-log">
            <summary>Module notes / prephase review</summary>
            {(() => {
              const parsed = parsePrephaseReview(module.actualState);
              if (!parsed) {
                return <pre>{module.actualState}</pre>;
              }
              return (
                <div className="ops-stack">
                  <div className="detail-box">
                    <p className="label">Title Rewrite</p>
                    <p className="ops-muted">{parsed.titleRewrite}</p>
                  </div>
                  <div className="detail-box">
                    <p className="label">Description Rewrite</p>
                    <p className="ops-muted">{parsed.descriptionRewrite}</p>
                  </div>
                  <div className="detail-box">
                    <p className="label">Additions</p>
                    {parsed.additions.length === 0 ? (
                      <p className="ops-muted">No concrete additions listed.</p>
                    ) : (
                      <ul>
                        {parsed.additions.map((item, index) => (
                          <li key={`add-${module.id}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="detail-box">
                    <p className="label">Risks</p>
                    {parsed.risks.length === 0 ? (
                      <p className="ops-muted">No explicit risks listed.</p>
                    ) : (
                      <ul>
                        {parsed.risks.map((item, index) => (
                          <li key={`risk-${module.id}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="detail-box">
                    <p className="label">Ready For Build</p>
                    <p className={`status-pill ${parsed.readyForBuild.toUpperCase().startsWith("YES") ? "done" : "active"}`}>
                      {parsed.readyForBuild}
                    </p>
                    <p className="label" style={{ marginTop: "0.55rem" }}>Missing Before Build</p>
                    {parsed.missingBeforeBuild.length === 0 ? (
                      <p className="ops-muted">No blockers listed.</p>
                    ) : (
                      <ul>
                        {parsed.missingBeforeBuild.map((item, index) => (
                          <li key={`missing-${module.id}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <details>
                    <summary>Raw note</summary>
                    <pre>{module.actualState}</pre>
                  </details>
                </div>
              );
            })()}
          </details>
        ) : null}
      </article>
    );
  }

  return (
    <section className="ops-main-grid">
      {showRunBuilder ? (
        <details className="card span-6" open>
          <summary>
            <h2>Lifecycle Engine (vNext)</h2>
          </summary>
          <p>Modular state-based execution with Step/Batch mode.</p>

          <form onSubmit={onCreateRun} className="actions-list">
            <h3>Create Run</h3>
            <label>Run title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            <label>Mode</label>
            <select value={mode} onChange={(event) => setMode(event.target.value as "STEP" | "BATCH")}>
              <option value="STEP">STEP (stop after module)</option>
              <option value="BATCH">BATCH (auto-continue)</option>
            </select>
            <label>Techstack Preset</label>
            <select value={techstackPresetId} onChange={(event) => onPresetChange(event.target.value)}>
              {techstackPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <label className="checkbox-label">
              <input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} />
              Auto start requested (run remains DRAFT until Enable Codex)
            </label>
            <label>Modules JSON</label>
            <textarea rows={14} value={modulesJson} onChange={(event) => setModulesJson(event.target.value)} />
            <button type="submit" disabled={controlsDisabled}>{busy ? "Creating..." : "Create Lifecycle Run"}</button>
          </form>
        </details>
      ) : null}

      {error ? (
        <section className="card span-12">
          <p className="error">{error}</p>
        </section>
      ) : null}

      {activeRun ? (
        <>
          <section className="card span-8">
            <h3>Active Run Modules</h3>
            <p className="visual-id-pill">Run {activeRun.run.id.slice(0, 8)} / {activeRun.run.status}</p>
            <p className="ops-subtle truncate-1" title={activeRun.run.title}>
              {activeRun.run.title} • {activeRun.run.classification} • {activeRun.run.mode}
            </p>
            {activeRun.run.status === "DRAFT" ? (
              <div className="task-actions-inline">
                <button onClick={onRunPrephase} disabled={controlsDisabled}>
                  {prephaseBusy ? "Running Prephase..." : "Run Prephase Review"}
                </button>
                <button onClick={() => onStartBuild(activeRun.run.id)} disabled={controlsDisabled}>
                  {startBusy ? "Starting..." : "Enable Codex"}
                </button>
              </div>
            ) : null}

            <div className="detail-grid lifecycle-modules-grid">
              {activeModules.length === 0 ? (
                <article className="detail-box">
                  <p className="ops-muted">No active modules.</p>
                </article>
              ) : (
                activeModules.map((module) => renderModuleCard(module))
              )}
            </div>

            {archivedModules.length > 0 ? (
              <details className="task-section-block done-section">
                <summary>Archived Completed Modules ({archivedModules.length})</summary>
                <div className="detail-grid lifecycle-modules-grid">
                  {archivedModules.map((module) => renderModuleCard(module))}
                </div>
              </details>
            ) : null}
          </section>

          <section className="card span-4 actions-list lifecycle-control-panel">
            <h3>Agent Control</h3>
            {maintenanceRunId ? (
              <button
                type="button"
                disabled={controlsDisabled || maintenanceBusy}
                onClick={() => openMaintenanceModal(maintenanceRunId)}
              >
                {maintenanceBusy ? "Adding..." : "Add Module"}
              </button>
            ) : (
              <p className="ops-muted">Add Module available after DEPLOYED.</p>
            )}

            <hr className="ops-separator" />
            <h3>Agent Live Status</h3>
            <p className="agent-live-pill">
              {agentState.status}
              {agentStateBusy ? " (syncing...)" : ""}
            </p>
            {agentState.runId ? (
              <p className="ops-muted">
                Run {agentState.runId.slice(0, 8)} • updated{" "}
                {agentState.updatedAt ? new Date(agentState.updatedAt).toLocaleString("de-DE") : "unknown"}
              </p>
            ) : (
              <p className="ops-muted">No agent run recorded.</p>
            )}
            {agentState.failureReason ? <p className="error">{agentState.failureReason}</p> : null}
            <div className="detail-box">
              <p className="label">Codex Runtime Snapshot</p>
              {agentState.codexStatusSnapshot.length === 0 ? (
                <p className="ops-muted">No snapshot available yet.</p>
              ) : (
                <pre className="agent-log-preview">{agentState.codexStatusSnapshot.join("\n")}</pre>
              )}
            </div>
            <button type="button" onClick={onRunAgent} disabled={controlsDisabled || runAgentBusy}>
              {runAgentBusy ? "Triggering..." : "Run Agent"}
            </button>
            <AgentLiveStreamModal runId={agentState.runId} disabled={!agentState.runId} />
            {agentIsActive ? (
              <p className="ops-subtle">Controls locked while agent is active.</p>
            ) : null}
          </section>
        </>
      ) : showRunBuilder ? null : (
        <section className="card span-12">
          <h3>No Active Lifecycle Run</h3>
          <p className="ops-muted">Create a run in Lifecycle Builder.</p>
        </section>
      )}

      {maintenanceModalOpen ? (
        <div className="stream-modal-backdrop" role="dialog" aria-modal="true" aria-label="Add maintenance module">
          <div className="stream-modal">
            <div className="stream-modal-head">
              <h3>Add Module (Maintenance)</h3>
              <button type="button" onClick={() => setMaintenanceModalOpen(false)} disabled={maintenanceBusy}>
                Close
              </button>
            </div>
            <p className="ops-muted">Target run: {maintenanceTargetRunId.slice(0, 8)}</p>
            <section className="bootstrap-box">
              <label>Module Type</label>
              <select
                value={maintenanceDraft.moduleType}
                onChange={(event) =>
                  setMaintenanceDraft((current) => ({
                    ...current,
                    moduleType: event.target.value as "CHANGE" | "FIX" | "TEARDOWN",
                  }))
                }
              >
                <option value="CHANGE">CHANGE</option>
                <option value="FIX">FIX</option>
                <option value="TEARDOWN">TEARDOWN</option>
              </select>
              <label>Title</label>
              <input
                value={maintenanceDraft.title}
                onChange={(event) => setMaintenanceDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Short maintenance objective"
              />
              <label>Description</label>
              <textarea
                rows={4}
                value={maintenanceDraft.description}
                onChange={(event) => setMaintenanceDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Free text: scope, expected change/fix, acceptance notes"
              />
              <label>Risk Level</label>
              <select
                value={maintenanceDraft.riskLevel}
                onChange={(event) =>
                  setMaintenanceDraft((current) => ({
                    ...current,
                    riskLevel: event.target.value as "LOW" | "MEDIUM" | "HIGH",
                  }))
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </section>
            <div className="task-actions-inline">
              <button
                type="button"
                disabled={
                  controlsDisabled ||
                  maintenanceBusy ||
                  !maintenanceTargetRunId ||
                  maintenanceDraft.title.trim().length < 2 ||
                  maintenanceDraft.description.trim().length < 2
                }
                onClick={() => onAppendMaintenanceModule(maintenanceTargetRunId)}
              >
                {maintenanceBusy ? "Adding..." : "Create Module"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
