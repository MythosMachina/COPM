import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { CopmApiClient } from "@/lib/orchestrator/copm-api-client";
import { getOrchestratorConfig, type OrchestratorConfig } from "@/lib/orchestrator/config";
import { buildLifecyclePrephasePrompt, buildLifecycleSystemPrompt } from "@/lib/orchestrator/prompt-templates";
import {
  formatQuestionDoc,
  formatResumeContext,
  listOpenQuestions,
  parseAnswers,
  parseQuestions,
} from "@/lib/orchestrator/question-bridge";
import {
  createAgentRun,
  finishAgentRun,
  getLatestAgentRun,
  hasBlockingRun,
  heartbeatAgentRun,
  markAgentRunRunning,
  markStaleRunningRunsFailed,
} from "@/lib/services/agent-run-service";
import { getDomNexAdapterRuntimeSecrets } from "@/lib/services/domnex-adapter-service";
import { getGitHubRuntimeSecretsForProject } from "@/lib/services/github-adapter-service";
import { processPendingDomNexProvisioning } from "@/lib/services/domnex-provisioning-service";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestionKey(value: string): string {
  return normalizeText(value)
    .replace(/[`"'.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWorkspaceConsistencyQuestion(value: string): boolean {
  const text = normalizeQuestionKey(value);
  return (
    text.includes("unexpected changes were detected in the working directory") ||
    (text.includes("unerwartete") && text.includes("working directory")) ||
    (text.includes("unerwartete") && text.includes("dateien") && text.includes("ausfuehrung"))
  );
}

function taskRequiresOperatorFeedback(task: {
  requiresOperatorFeedback?: boolean;
  title: string;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
}): boolean {
  if (task.requiresOperatorFeedback) {
    return true;
  }

  const content = normalizeText(
    [task.title, task.istState, task.sollState, task.technicalPlan, task.riskImpact].filter(Boolean).join("\n"),
  );

  const patterns = [
    "kein done ohne rueckmeldung des operators",
    "ohne rueckmeldung des operators",
    "operator rueckmeldung",
    "operator feedback",
    "warte auf rueckmeldung des operators",
    "warte auf operator",
    "wait for operator",
  ];

  return patterns.some((pattern) => content.includes(pattern));
}

function buildOperatorGateQuestion(tasks: Array<{ visualId: string; title: string }>): string {
  const lines = [
    "Operator-Rueckmeldung erforderlich, bevor ich fortfahre.",
    "Bitte priorisiere oder bestaetige das weitere Vorgehen fuer folgende ACTIVE Tasks:",
    ...tasks.map((task) => `- ${task.visualId}: ${task.title}`),
    "Antworte mit Prioritaet (z. B. nur Task-ID oder Reihenfolge).",
  ];
  return lines.join("\n");
}

function isOperatorGateQuestion(value: string): boolean {
  const text = normalizeText(value);
  const patterns = [
    "operator-rueckmeldung erforderlich",
    "operator rueckmeldung erforderlich",
    "bevor ich fortfahre",
    "antworte mit prioritaet",
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

function pickActiveLifecycleModule(modules: Array<{ status: string; moduleOrder: number; id: string }>): { id: string } | null {
  const priority = ["RUNNING", "BLOCKED", "PENDING"] as const;
  for (const status of priority) {
    const match = modules.find((entry) => entry.status === status);
    if (match) {
      return { id: match.id };
    }
  }
  const fallback = [...modules].sort((a, b) => a.moduleOrder - b.moduleOrder)[0];
  return fallback ? { id: fallback.id } : null;
}

function hasActiveLifecycleModules(modules: Array<{ status: string }>): boolean {
  return modules.some((entry) => entry.status !== "COMPLETED" && entry.status !== "SKIPPED");
}

const GUARD_RETRY_PREFIX = "GUARD_RETRY:";

function logInfo(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[COPM-AGENT] ${message}`);
    return;
  }

  console.log(`[COPM-AGENT] ${message}`, details);
}

function logError(message: string, details?: unknown) {
  if (details === undefined) {
    console.error(`[COPM-AGENT] ${message}`);
    return;
  }

  console.error(`[COPM-AGENT] ${message}`, details);
}

function buildPrompt(
  basePrompt: string,
  resumeContext: string,
  lifecyclePrompt: string,
  phase: "PREPHASE" | "BUILD",
  baseUrl: string,
  apiToken: string,
  projectId: string,
  projectVisualId: string,
  workspacePath: string,
  domnexRuntimeEnabled: boolean,
  githubRuntimeEnabled: boolean,
): string {
  const domnexRules = domnexRuntimeEnabled
    ? [
        "- DomNex adapter is enabled for this runtime.",
        "- For domain automation use env vars DOMNEX_BASE_URL and DOMNEX_API_TOKEN (already injected).",
        "- Do not print or persist secret token values in logs/docs.",
      ]
    : ["- DomNex adapter may be unavailable in this runtime; if missing, skip domain provisioning safely."];
  const githubRules = githubRuntimeEnabled
    ? [
        "- GitHub adapter is enabled for this runtime.",
        "- For GitHub delivery use env vars GITHUB_API_TOKEN, GITHUB_USERNAME, GITHUB_EMAIL (already injected).",
        "- Never print or persist GitHub credential values in logs/docs.",
      ]
    : ["- GitHub adapter may be unavailable in this runtime; if missing, skip GitHub push/release tasks safely."];

  return [
    basePrompt.trim(),
    "",
    `Execution phase: ${phase}`,
    "Additional execution rules:",
    `- COPM Base URL (authoritative): ${baseUrl}`,
    `- COPM API Token (authoritative): ${apiToken}`,
    `- Bound project ID: ${projectId}`,
    `- Bound project visual ID: ${projectVisualId}`,
    `- Bound workspace directory: ${workspacePath}`,
    `- Mandatory project database name: ${projectVisualId}`,
    `- For COPM API calls always send header: Authorization: Bearer ${apiToken}`,
    "- Do not ask for API base URL or token; they are provided above.",
    "- Hard boundary: operate only inside the bound workspace directory above.",
    "- Hard boundary: never read, write, move, or delete files outside the bound workspace directory.",
    "- Exception for deployment/provisioning modules: host-level operations outside workspace are allowed when required (e.g. systemd unit files, systemctl enable/start, runtime directories) to establish persistent project runtime.",
    `- Host-level operations must stay project-scoped using service/runtime naming tied to ${projectVisualId} (example: ${projectVisualId.toLowerCase()}-app.service).`,
    "- Never modify unrelated host services, unrelated projects, or global system policy.",
    "- Hard boundary: never modify COPM source tree, COPM configs, COPM services, or COPM runtime database.",
    "- Database isolation rule: this project must use only its own dedicated database named exactly like project visual ID.",
    "- Never use, read, write, or migrate the COPM operations database (e.g. codex_ops).",
    "- If SQL identifier quoting is required, use the same project DB name with proper quoting (example for PostgreSQL: \"PRJ-0001\").",
    "- Ensure application DATABASE_URL targets only the project-dedicated DB, never COPM DB.",
    "- Prefer token-auth project endpoints (/api/v1/projects/...) over admin session endpoints (/api/v1/admin/...) for runtime actions.",
    "- Context minimization: focus on active lifecycle modules and active tasks; consult archived docs/tasks only when required for dependency or decisions.",
    "- If historical context is needed, fetch targeted details via COPM API instead of assuming all history is preloaded.",
    "- Keep COPM synchronized after each significant implementation step.",
    "- Completion gate: do not finish execution while any lifecycle module remains ACTIVE (PENDING/RUNNING/BLOCKED).",
    "- Completion gate: before finishing, verify module states via COPM API and close all active modules or continue execution.",
    "- Completion gate: every module completion must include synchronized documentation/evidence in COPM.",
    "- Ask follow-up questions only when project scope is ambiguous or required inputs are missing.",
    "- If project scope is clear, continue autonomously without follow-up questions.",
    ...(phase === "PREPHASE"
      ? [
          "- PREPHASE mode: review and rewrite proposals only.",
          "- PREPHASE mode: do not execute build/provisioning/deploy steps.",
          "- PREPHASE mode: do not mutate lifecycle status; provide actionable proposal output only.",
        ]
      : []),
    "- If blocked, print exactly one line as: COPM_QUESTION: your concrete question text",
    "- Never emit placeholders (e.g. '<question>' or 'your concrete question text') as a question.",
    "- Continue autonomously whenever enough context exists.",
    "- For DomNex provisioning: start/verify upstream service first, then preflight, then create.",
    "- Hard gate before provisioning: application must run as persistent autostart service (systemd or platform equivalent), not as temporary agent-only process.",
    "- Verify upstream is externally reachable from DomNex network path before preflight/create.",
    "- Never mark provisioning tasks DONE if preflight.ready is false or upstream_reachable is false.",
    "- If domain token/zone does not allow requested fqdn, document decision and keep task ACTIVE until resolved or explicitly approved fallback is synced.",
    "- Never use COPM API port (typically :3300) as project upstream unless task scope explicitly defines COPM as upstream target.",
    "- If task requires existing website/service, verify process is actually listening on expected app port before closing task.",
    ...domnexRules,
    ...githubRules,
    lifecyclePrompt ? `\n${lifecyclePrompt.trim()}` : "",
    resumeContext ? `\n${resumeContext.trim()}` : "",
  ]
    .join("\n")
    .trim();
}

function sanitizeTerminalLine(line: string): string {
  // Strip ANSI escape/control sequences produced by TTY applications.
  let value = line
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u009B[0-9;?]*[ -/]*[@-~]/g, "");

  // Remove remaining non-printable control chars except horizontal tab.
  value = value.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "");
  return value;
}

function isInvalidQuestionText(value: string): boolean {
  const text = value.replace(/\\n/g, "\n").trim();
  if (!text) {
    return true;
  }

  const normalized = text.toLowerCase();
  if (
    normalized === "question" ||
    normalized === "<question>" ||
    normalized.includes("your concrete question text")
  ) {
    return true;
  }

  // Guard against accidental capture of policy/instruction lines.
  if (
    normalized.includes("keine weiteren rueckfragen") ||
    normalized.includes("soll ich") ||
    normalized.includes("autarker entwicklungsmodus")
  ) {
    return true;
  }

  return false;
}

function normalizeCapturedQuestion(raw: string): string {
  const expanded = raw.replace(/\\n/g, "\n").trim();
  const lines = expanded
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }

  const firstLine = lines[0] as string;
  if (firstLine.toLowerCase().includes("your concrete question text")) {
    return "";
  }

  if (firstLine.startsWith("- ")) {
    return "";
  }

  return firstLine;
}

function extractModuleReviewBlocks(output: string): Map<number, string> {
  const map = new Map<number, string>();
  const pattern = /\[\[MODULE_REVIEW:(\d+)\]\]([\s\S]*?)\[\[\/MODULE_REVIEW\]\]/g;
  let match = pattern.exec(output);
  while (match) {
    const order = Number.parseInt(match[1] ?? "", 10);
    const content = (match[2] ?? "").trim();
    if (Number.isFinite(order) && order > 0 && content) {
      map.set(order, content);
    }
    match = pattern.exec(output);
  }
  return map;
}

function formatRunReportDoc(input: {
  runId: string;
  trigger: string;
  status: "DONE" | "FAILED" | "WAITING_INPUT";
  exitCode?: number | null;
  failureReason?: string | null;
  output: string;
}): { name: string; content: string } {
  const clippedOutput = input.output.trim().slice(0, 12_000);
  const statusLabel =
    input.status === "DONE" ? "DONE (Erfolgreich)" : input.status === "FAILED" ? "FAILED (Fehler)" : "WAITING_INPUT";
  const safeOutput = clippedOutput.replace(/~~~/g, "~~ ~");
  return {
    name: "AGENT:RUN:REPORT",
    content: [
      "---",
      "kind: RUN_SUMMARY",
      `status: ${input.status}`,
      `runId: ${input.runId}`,
      `trigger: ${input.trigger}`,
      `exitCode: ${input.exitCode ?? "null"}`,
      `failureReason: ${input.failureReason?.trim() || "none"}`,
      "source: COPM_AGENT",
      "---",
      "",
      "# Agent Run Summary",
      "",
      "## Ueberblick",
      `- Run ID: \`${input.runId}\``,
      `- Trigger: \`${input.trigger}\``,
      `- Status: \`${statusLabel}\``,
      `- Exit Code: \`${input.exitCode ?? "null"}\``,
      `- Failure Reason: \`${input.failureReason?.trim() || "none"}\``,
      "",
      "## Output (gekürzt)",
      "~~~text",
      safeOutput || "(no output captured)",
      "~~~",
    ].join("\n"),
  };
}

async function appendRunStream(pathname: string, lines: string[]) {
  if (lines.length === 0) {
    return;
  }
  const payload = `${lines.join("\n")}\n`;
  await fs.appendFile(pathname, payload, "utf8");
}

async function ensureWorkspace(workspaceRoot: string, visualId: string): Promise<string> {
  const workspacePath = path.join(workspaceRoot, visualId);
  await fs.mkdir(workspacePath, { recursive: true });
  return workspacePath;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });
  });
}

async function captureCodexStatusSnapshot(
  command: string,
  cwd: string,
  timeoutMs = 5000,
): Promise<{ code: number; timedOut: boolean; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, ["status"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let closed = false;
    let timedOut = false;

    const finish = (code: number | null) => {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        timedOut,
        stdout,
        stderr,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // Ignore kill errors.
      }
      setTimeout(() => finish(124), 200).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => finish(code));
    child.on("error", (error) => {
      stderr = `${stderr}\n${error.message}`.trim();
      finish(1);
    });
  });
}

async function ensureWorkspaceRuntimePaths(workspaceRoot: string, visualId: string): Promise<{ runtimeDir: string }> {
  const runtimeDir = path.join(workspaceRoot, ".copm-runtime", visualId);
  await fs.mkdir(runtimeDir, { recursive: true });
  return { runtimeDir };
}

async function checkpointWorkspaceIfGitRepo(workspacePath: string, runId: string): Promise<string | null> {
  const gitRepoCheck = await runCommand("git", ["rev-parse", "--is-inside-work-tree"], workspacePath);
  if (gitRepoCheck.code !== 0 || !gitRepoCheck.stdout.trim().toLowerCase().startsWith("true")) {
    return null;
  }

  const status = await runCommand("git", ["status", "--porcelain=v1"], workspacePath);
  const dirtyLines = status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (dirtyLines.length === 0) {
    return "Workspace git state clean.";
  }

  const addResult = await runCommand("git", ["add", "-A"], workspacePath);
  if (addResult.code !== 0) {
    return `Workspace checkpoint skipped: git add failed (${addResult.stderr.trim() || "unknown error"}).`;
  }

  const shortRunId = runId.slice(0, 8);
  const commitResult = await runCommand(
    "git",
    [
      "-c",
      "user.name=COPM Agent",
      "-c",
      "user.email=copm-agent@local",
      "commit",
      "-m",
      `chore(copm): workspace checkpoint before run ${shortRunId}`,
      "--no-verify",
    ],
    workspacePath,
  );

  if (commitResult.code === 0) {
    return `Workspace checkpoint committed (${dirtyLines.length} change(s), run ${shortRunId}).`;
  }

  const msg = `${commitResult.stdout}\n${commitResult.stderr}`.toLowerCase();
  if (msg.includes("nothing to commit")) {
    return "Workspace checkpoint skipped: nothing to commit.";
  }

  return `Workspace checkpoint failed (${dirtyLines.length} change(s)): ${commitResult.stderr.trim() || "unknown error"}.`;
}

export class CopmAgentWorker {
  private readonly config: OrchestratorConfig;
  private readonly client: CopmApiClient;
  private readonly activeProjects = new Set<string>();

  constructor(config?: OrchestratorConfig) {
    this.config = config ?? getOrchestratorConfig();
    this.client = new CopmApiClient(this.config.baseUrl, this.config.apiToken);
  }

  async bootstrap(): Promise<void> {
    await markStaleRunningRunsFailed(this.config.staleRunMinutes);
    await fs.mkdir(this.config.workspaceRoot, { recursive: true });
    logInfo("Bootstrap completed", {
      baseUrl: this.config.baseUrl,
      workspaceRoot: this.config.workspaceRoot,
      pollIntervalMs: this.config.pollIntervalMs,
      staleRunMinutes: this.config.staleRunMinutes,
      maxRunMs: this.config.maxRunMs,
      codexCommand: this.config.codexCommand,
    });
  }

  async tick(trigger = "AUTO"): Promise<void> {
    await markStaleRunningRunsFailed(this.config.staleRunMinutes);
    await processPendingDomNexProvisioning();
    const projects = await this.client.listProjects();
    const optInProjects = projects.filter((project) => project.autonomousAgentEnabled);
    const filtered = this.config.projectFilter
      ? optInProjects.filter(
          (project) => project.visualId === this.config.projectFilter || project.id === this.config.projectFilter,
        )
      : optInProjects;

    for (const project of filtered) {
      await this.processProject(project.id, project.visualId, project.updatedAt, trigger);
    }
  }

  async triggerProject(projectId: string): Promise<void> {
    const project = await this.client.getProject(projectId);
    if (!project.autonomousAgentEnabled) {
      throw new ValidationError("Project autonomous agent opt-in is disabled");
    }
    await this.processProject(project.id, project.visualId, project.updatedAt, "MANUAL");
  }

  private async processProject(projectId: string, projectVisualId: string, projectUpdatedAt: string, trigger: string) {
    if (this.activeProjects.has(projectId)) {
      return;
    }

    const blockingRun = await hasBlockingRun(projectId);
    if (blockingRun) {
      return;
    }

    const docs = await this.client.listDocumentation(projectId);
    const openQuestions = listOpenQuestions(docs);

    if (openQuestions.length > 0) {
      const latestRun = await getLatestAgentRun(projectId);
      if (latestRun && latestRun.status !== "WAITING_INPUT") {
        await finishAgentRun({
          runId: latestRun.id,
          status: "WAITING_INPUT",
          summary: `Waiting for ${openQuestions.length} open question(s)`,
          failureReason: null,
        });
      }
      return;
    }

    const latestRun = await getLatestAgentRun(projectId);
    const lifecycleRuns = await this.client.listLifecycleRuns(projectId);
    const hasDraftLifecycle = lifecycleRuns.some((run) => run.status === "DRAFT");
    const hasRunnableLifecycle = lifecycleRuns.some(
      (run) => run.status === "RUNNING" || run.status === "READY" || run.status === "BLOCKED",
    );
    const hasActiveLifecycle = lifecycleRuns.some((run) =>
      run.status === "RUNNING" || run.status === "READY" || run.status === "BLOCKED" || run.status === "DRAFT",
    );
    if (!hasActiveLifecycle) {
      const project = await this.client.getProject(projectId);
      if (project.autonomousAgentEnabled) {
        await this.client.updateProject(projectId, { autonomousAgentEnabled: false });
      }
      return;
    }
    const hasProjectChangesSinceLastRun = latestRun
      ? Date.parse(projectUpdatedAt) > Date.parse(latestRun.updatedAt)
      : false;
    const isManualTrigger = trigger !== "AUTO";
    if (!isManualTrigger && hasDraftLifecycle && latestRun?.status === "DONE") {
      // Prephase completed successfully. Wait for operator action (Start Build / new edits)
      // instead of looping autonomous runs against unchanged DRAFT modules.
      return;
    }
    const shouldContinueActiveLifecycle = Boolean(
      hasRunnableLifecycle && latestRun && latestRun.status === "DONE",
    );
    const shouldStart =
      isManualTrigger ||
      !latestRun ||
      latestRun.status === "CANCELED" ||
      latestRun.status === "WAITING_INPUT" ||
      (latestRun.status === "FAILED" &&
        (hasProjectChangesSinceLastRun || (latestRun.failureReason ?? "").startsWith(GUARD_RETRY_PREFIX))) ||
      (latestRun.status === "DONE" && (hasProjectChangesSinceLastRun || shouldContinueActiveLifecycle));

    if (!shouldStart) {
      return;
    }

    await this.startRun(projectId, projectVisualId, latestRun?.status === "WAITING_INPUT" ? "RESUME" : trigger);
  }

  private async startRun(projectId: string, projectVisualId: string, trigger: string) {
    this.activeProjects.add(projectId);

    try {
      const [kickstart, docs, tasksAtStart, domnexRuntime, githubRuntime] = await Promise.all([
        this.client.getAiKickstart(projectId),
        this.client.listDocumentation(projectId),
        this.client.listTasks(projectId),
        getDomNexAdapterRuntimeSecrets(),
        getGitHubRuntimeSecretsForProject(projectId),
      ]);
      const lifecycleRuns = await this.client.listLifecycleRuns(projectId);
      const lifecycleStatusPriority = ["RUNNING", "BLOCKED", "READY", "DRAFT"] as const;
      const activeLifecycleRun =
        lifecycleStatusPriority
          .map((status) => lifecycleRuns.find((run) => run.status === status) ?? null)
          .find((run) => run !== null) ?? null;
      const activeLifecycle = activeLifecycleRun
        ? await this.client.getLifecycleRun(projectId, activeLifecycleRun.id)
        : null;
      const activeLifecycleModule = activeLifecycle ? pickActiveLifecycleModule(activeLifecycle.modules) : null;
      const phase: "PREPHASE" | "BUILD" = activeLifecycle?.run.status === "DRAFT" ? "PREPHASE" : "BUILD";
      const lifecyclePrompt = activeLifecycle
        ? phase === "PREPHASE"
          ? buildLifecyclePrephasePrompt(activeLifecycle)
          : buildLifecycleSystemPrompt(activeLifecycle)
        : "";
      const gatedActiveTasksAtStart = tasksAtStart.filter(
        (task) => task.status === "ACTIVE" && taskRequiresOperatorFeedback(task),
      );
      const { knownAnsweredQuestionKeys, hasAnsweredWorkspaceConsistencyQuestion } = (() => {
        const questions = parseQuestions(docs);
        const answers = parseAnswers(docs);
        const answeredIds = new Set(answers.map((entry) => entry.questionId));
        const answeredQuestions = questions.filter((entry) => answeredIds.has(entry.questionId));
        const keys = new Set(answeredQuestions.map((entry) => normalizeQuestionKey(entry.content)).filter(Boolean));
        return {
          knownAnsweredQuestionKeys: keys,
          hasAnsweredWorkspaceConsistencyQuestion: answeredQuestions.some((entry) =>
            isWorkspaceConsistencyQuestion(entry.content),
          ),
        };
      })();
      const enforceOperatorGate = trigger !== "RESUME";

      const basePrompt =
        kickstart.startupPrompts?.systemPrompt?.trim() ??
        kickstart.startupPrompts?.oneShotPrompt?.trim() ??
        "";
      if (!basePrompt) {
        throw new NotFoundError("Kickstart payload missing startupPrompts.systemPrompt/oneShotPrompt");
      }

      const resumeContext = formatResumeContext(docs, {
        maxPairs: 3,
        maxQuestionChars: 500,
        maxAnswerChars: 700,
      });
      const workspacePath = await ensureWorkspace(this.config.workspaceRoot, projectVisualId);
      const { runtimeDir } = await ensureWorkspaceRuntimePaths(this.config.workspaceRoot, projectVisualId);
      const prompt = buildPrompt(
        basePrompt,
        resumeContext,
        lifecyclePrompt,
        phase,
        this.config.baseUrl,
        this.config.apiToken,
        projectId,
        projectVisualId,
        workspacePath,
        Boolean(domnexRuntime.enabled && domnexRuntime.baseUrl && domnexRuntime.apiToken),
        Boolean(githubRuntime.enabled && githubRuntime.apiToken && githubRuntime.username && githubRuntime.email),
      );

      const promptPath = path.join(runtimeDir, `copm-prompt-${Date.now()}.md`);
      await fs.writeFile(promptPath, prompt, "utf8");

      const effectiveArgs =
        this.config.codexArgs.length > 0
          ? this.config.codexArgs
          : ["exec", "-", "--skip-git-repo-check", "--sandbox", "danger-full-access"];
      const commandString = [this.config.codexCommand, ...effectiveArgs].join(" ").trim();
      const run = await createAgentRun({
        projectId,
        trigger,
        workspacePath,
        command: commandString,
        promptPath,
      });
      const runStreamPath = path.join(runtimeDir, `agent-run-${run.id}.log`);
      await fs.writeFile(
        runStreamPath,
        [`[RUN_START] ${new Date().toISOString()} runId=${run.id} trigger=${trigger}`, "[RUN_OUTPUT]"].join("\n") + "\n",
        "utf8",
      );
      const outputLines: string[] = [];
      const checkpointSummary = await checkpointWorkspaceIfGitRepo(workspacePath, run.id);
      if (checkpointSummary) {
        await appendRunStream(runStreamPath, [`[WORKSPACE_GUARD] ${checkpointSummary}`]);
        outputLines.push(`[COPM] ${checkpointSummary}`);
      }

      const codexStatus = await captureCodexStatusSnapshot(this.config.codexCommand, workspacePath, 5000);
      const codexStatusHeader = `[COPM] Codex status snapshot at run start (exit=${codexStatus.code}, timeout=${codexStatus.timedOut ? "yes" : "no"})`;
      const codexStatusLines = codexStatus.stdout
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => sanitizeTerminalLine(line).trim())
        .filter(Boolean)
        .slice(0, 24)
        .map((line) => `[COPM][CODEX_STATUS] ${line}`);
      const codexStatusStderr = sanitizeTerminalLine(codexStatus.stderr).trim();
      const codexStatusStreamLines = [codexStatusHeader, ...codexStatusLines];
      if (codexStatusStderr) {
        codexStatusStreamLines.push(`[COPM][CODEX_STATUS][stderr] ${codexStatusStderr.slice(0, 400)}`);
      }
      if (codexStatusLines.length === 0 && !codexStatusStderr) {
        codexStatusStreamLines.push("[COPM][CODEX_STATUS] No output captured.");
      }
      await appendRunStream(runStreamPath, codexStatusStreamLines);
      outputLines.push(codexStatusHeader, ...codexStatusLines);
      if (codexStatusStderr) {
        outputLines.push(`[COPM][CODEX_STATUS][stderr] ${codexStatusStderr.slice(0, 400)}`);
      }

      const persistRunReport = async (input: {
        status: "DONE" | "FAILED" | "WAITING_INPUT";
        exitCode?: number | null;
        failureReason?: string | null;
        output: string;
      }): Promise<boolean> => {
        if (phase === "PREPHASE" && activeLifecycle && activeLifecycleModule) {
          try {
            const clippedOutput = input.output.trim().slice(0, 12_000);
            const parsedBlocks = extractModuleReviewBlocks(clippedOutput);
            const runMeta = [
              "Prephase run result",
              `status: ${input.status}`,
              `runId: ${run.id}`,
              `trigger: ${run.trigger}`,
              `exitCode: ${input.exitCode ?? "null"}`,
              `failureReason: ${input.failureReason?.trim() || "none"}`,
            ].join("\n");

            for (const moduleEntry of activeLifecycle.modules) {
              const moduleBlock = parsedBlocks.get(moduleEntry.moduleOrder);
              const moduleReview = moduleBlock
                ? [runMeta, "", moduleBlock].join("\n")
                : [
                    runMeta,
                    "",
                    "No explicit module block captured by Codex for this module.",
                    "Fallback excerpt:",
                    clippedOutput || "(no output captured)",
                  ].join("\n");
              await this.client.upsertLifecycleModulePrephaseReview(
                projectId,
                activeLifecycle.run.id,
                moduleEntry.id,
                moduleReview,
              );
            }
            return true;
          } catch (error) {
            logError("Failed to persist prephase review in lifecycle module", {
              runId: run.id,
              message: error instanceof Error ? error.message : String(error),
            });
            return false;
          }
        }

        try {
          await this.client.createDocumentation(
            projectId,
            formatRunReportDoc({
              runId: run.id,
              trigger: run.trigger,
              status: input.status,
              exitCode: input.exitCode ?? null,
              failureReason: input.failureReason ?? null,
              output: input.output,
            }),
          );
          return true;
        } catch (error) {
          logError("Failed to persist run report documentation", {
            runId: run.id,
            message: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      };

      const child = spawn(this.config.codexCommand, effectiveArgs, {
        cwd: workspacePath,
        env: {
          ...process.env,
          COPM_BASE_URL: this.config.baseUrl,
          COPM_API_TOKEN: this.config.apiToken,
          COPM_AGENT_BASE_URL: this.config.baseUrl,
          COPM_PROJECT_ID: projectId,
          COPM_PROJECT_VISUAL_ID: projectVisualId,
          COPM_PROJECT_DB_NAME: projectVisualId,
          ...(domnexRuntime.baseUrl ? { DOMNEX_BASE_URL: domnexRuntime.baseUrl } : {}),
          ...(domnexRuntime.apiToken ? { DOMNEX_API_TOKEN: domnexRuntime.apiToken } : {}),
          ...(githubRuntime.apiToken ? { GITHUB_API_TOKEN: githubRuntime.apiToken } : {}),
          ...(githubRuntime.username ? { GITHUB_USERNAME: githubRuntime.username } : {}),
          ...(githubRuntime.email ? { GITHUB_EMAIL: githubRuntime.email } : {}),
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!child.pid) {
        const failureReason = "Unable to obtain child process pid";
        await finishAgentRun({
          runId: run.id,
          status: "FAILED",
          failureReason,
        });
        await persistRunReport({
          status: "FAILED",
          failureReason,
          output: "",
        });
        return;
      }

      await markAgentRunRunning(run.id, child.pid);

      const heartbeat = setInterval(() => {
        void heartbeatAgentRun(run.id);
      }, 5000);

      let waitingForInput = false;
      const seenQuestionKeys = new Set<string>();
      const runTimeout = setTimeout(() => {
        void (async () => {
          if (waitingForInput) {
            return;
          }

          if (!enforceOperatorGate || gatedActiveTasksAtStart.length === 0) {
            return;
          }

          const docs = await this.client.listDocumentation(projectId);
          const openQuestions = listOpenQuestions(docs);
          if (openQuestions.length === 0) {
            const questionId = crypto.randomBytes(6).toString("hex");
            const question = buildOperatorGateQuestion(
              gatedActiveTasksAtStart.map((task) => ({ visualId: task.visualId, title: task.title })),
            );
            await this.client.createDocumentation(projectId, formatQuestionDoc({ questionId, runId: run.id, question }));
            outputLines.push(`COPM_QUESTION: ${question}`);
          }

          waitingForInput = true;
          child.kill("SIGTERM");
        })().catch((error) => {
          logError("Failed enforcing operator gate timeout", {
            runId: run.id,
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }, this.config.maxRunMs);

      const processChunk = async (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        const lines = text
          .split(/\r?\n/)
          .map((line) => sanitizeTerminalLine(line).trim())
          .filter(Boolean);
        await appendRunStream(runStreamPath, lines);

        for (const line of lines) {
          outputLines.push(line);
          if (outputLines.length > 200) {
            outputLines.shift();
          }

          const marker = "COPM_QUESTION:";
          const idx = line.indexOf(marker);
          if (idx === -1) {
            continue;
          }

          const question = normalizeCapturedQuestion(line.slice(idx + marker.length));
          if (isInvalidQuestionText(question)) {
            // Ignore placeholder/policy artifacts and keep autonomous execution running.
            continue;
          }
          const questionKey = normalizeQuestionKey(question);
          if (waitingForInput || seenQuestionKeys.has(questionKey)) {
            continue;
          }
          if (knownAnsweredQuestionKeys.has(questionKey)) {
            outputLines.push(`[COPM] Previously answered question ignored: ${question}`);
            seenQuestionKeys.add(questionKey);
            continue;
          }
          if (hasAnsweredWorkspaceConsistencyQuestion && isWorkspaceConsistencyQuestion(question)) {
            outputLines.push(`[COPM] Repeated workspace consistency question ignored: ${question}`);
            seenQuestionKeys.add(questionKey);
            continue;
          }
          if (!enforceOperatorGate && isOperatorGateQuestion(question)) {
            // After an operator answer (RESUME), do not re-open the same operator-gate question.
            continue;
          }

          const questionId = crypto.randomBytes(6).toString("hex");
          const doc = formatQuestionDoc({ questionId, runId: run.id, question });
          await this.client.createDocumentation(projectId, doc);
          seenQuestionKeys.add(questionKey);
          waitingForInput = true;
          child.kill("SIGTERM");
          return;
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        void processChunk(chunk).catch((error) => {
          logError("Failed processing stdout chunk", error);
        });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        void processChunk(chunk).catch((error) => {
          logError("Failed processing stderr chunk", error);
        });
      });

      child.stdin.write(`${prompt}\n`);
      child.stdin.end();

      child.on("error", async (error) => {
        clearInterval(heartbeat);
        clearTimeout(runTimeout);
        const failureReason = error.message;
        const output = outputLines.join("\n");
        await appendRunStream(runStreamPath, [`[RUN_ERROR] ${new Date().toISOString()} ${failureReason}`]);
        await finishAgentRun({
          runId: run.id,
          status: "FAILED",
          failureReason,
          summary: output,
        });
        await persistRunReport({
          status: "FAILED",
          failureReason,
          output,
        });
        logError("Codex process error", error.message);
      });

      child.on("close", async (code) => {
        clearInterval(heartbeat);
        clearTimeout(runTimeout);
        await appendRunStream(runStreamPath, [`[RUN_CLOSE] ${new Date().toISOString()} exitCode=${code ?? "null"}`]);

        if (waitingForInput) {
          const output = outputLines.join("\n");
          await finishAgentRun({
            runId: run.id,
            status: "WAITING_INPUT",
            exitCode: code ?? null,
            summary: "Worker paused due to COPM question",
          });
          await persistRunReport({
            status: "WAITING_INPUT",
            exitCode: code ?? null,
            output,
          });
          logInfo("Run paused for operator input", { runId: run.id, projectId });
          return;
        }

        if (code === 0) {
          if (enforceOperatorGate && gatedActiveTasksAtStart.length > 0) {
            const docs = await this.client.listDocumentation(projectId);
            const openQuestions = listOpenQuestions(docs);
            if (openQuestions.length === 0) {
              const questionId = crypto.randomBytes(6).toString("hex");
              const question = buildOperatorGateQuestion(
                gatedActiveTasksAtStart.map((task) => ({ visualId: task.visualId, title: task.title })),
              );
              await this.client.createDocumentation(projectId, formatQuestionDoc({ questionId, runId: run.id, question }));
              outputLines.push(`COPM_QUESTION: ${question}`);
            }

            const output = outputLines.join("\n");
            await finishAgentRun({
              runId: run.id,
              status: "WAITING_INPUT",
              exitCode: 0,
              summary: "Waiting for operator response for gated task(s)",
            });
            await persistRunReport({
              status: "WAITING_INPUT",
              exitCode: 0,
              output,
            });
            logInfo("Run paused for operator-gated active tasks", {
              runId: run.id,
              projectId,
              gatedTasks: gatedActiveTasksAtStart.map((task) => task.visualId),
            });
            return;
          }

          const output = outputLines.join("\n");
          const hasDocumentation = await persistRunReport({
            status: "DONE",
            exitCode: 0,
            output,
          });
          const lifecycleRefs = await this.client.listLifecycleRuns(projectId);
          const activeLifecycleRef =
            lifecycleStatusPriority
              .map((status) => lifecycleRefs.find((entry) => entry.status === status) ?? null)
              .find((entry) => entry !== null) ?? null;
          const hasActiveModules = activeLifecycleRef
            ? hasActiveLifecycleModules((await this.client.getLifecycleRun(projectId, activeLifecycleRef.id)).modules)
            : false;

          const shouldBlockForActiveModules = phase === "BUILD" && hasActiveModules;
          if (!hasDocumentation || shouldBlockForActiveModules) {
            const guardReason = !hasDocumentation
              ? "Guard rail blocked DONE: run documentation persistence missing."
              : `${GUARD_RETRY_PREFIX} active lifecycle modules still present`;
            await finishAgentRun({
              runId: run.id,
              status: !hasDocumentation ? "FAILED" : "CANCELED",
              exitCode: 2,
              failureReason: guardReason,
              summary: output,
            });
            logError("Run completion blocked by guard rail", {
              runId: run.id,
              projectId,
              hasDocumentation,
              hasActiveModules,
            });
            return;
          }

          await finishAgentRun({
            runId: run.id,
            status: "DONE",
            exitCode: 0,
            summary: output,
          });
          await this.client.updateProject(projectId, { autonomousAgentEnabled: false });
          logInfo("Run finished successfully", { runId: run.id, projectId });
          return;
        }

        const output = outputLines.join("\n");
        const failureReason = `Codex exited with code ${code}`;
        await finishAgentRun({
          runId: run.id,
          status: "FAILED",
          exitCode: code ?? null,
          failureReason,
          summary: output,
        });
        await persistRunReport({
          status: "FAILED",
          exitCode: code ?? null,
          failureReason,
          output,
        });
        logError("Run failed", { runId: run.id, projectId, code });
      });
    } catch (error) {
      logError("Failed to start run", {
        projectId,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeProjects.delete(projectId);
    }
  }

  async runLoop(): Promise<never> {
    await this.bootstrap();

    while (true) {
      try {
        await this.tick("AUTO");
      } catch (error) {
        logError("Tick failed", error instanceof Error ? error.message : String(error));
      }

      await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }
}
