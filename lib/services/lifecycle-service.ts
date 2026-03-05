import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { touchProjectUpdatedAt } from "@/lib/services/project-service";
import type {
  LifecycleEvidenceDTO,
  LifecycleModuleDTO,
  LifecycleRunDTO,
  LifecycleRunDetailDTO,
  LifecycleTransitionDTO,
} from "@/types/domain";
import type {
  AppendLifecycleModuleInput,
  CreateLifecycleRunInput,
  ResumeLifecycleRunInput,
  UpsertLifecycleModulePrephaseReviewInput,
  UpdateLifecycleModuleDefinitionInput,
  UpdateLifecycleModuleInput,
} from "@/lib/validation/lifecycle-schemas";

type RunStatus = LifecycleRunDTO["status"];
type ModuleStatus = LifecycleModuleDTO["status"];
type ModuleType = LifecycleModuleDTO["moduleType"];

function toRunDTO(run: {
  id: string;
  projectId: string;
  title: string;
  mode: LifecycleRunDTO["mode"];
  status: RunStatus;
  classification: LifecycleRunDTO["classification"];
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): LifecycleRunDTO {
  return {
    id: run.id,
    projectId: run.projectId,
    title: run.title,
    mode: run.mode,
    status: run.status,
    classification: run.classification,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
  };
}

function toModuleDTO(module: {
  id: string;
  runId: string;
  moduleOrder: number;
  moduleType: LifecycleModuleDTO["moduleType"];
  title: string;
  description: string;
  config: unknown;
  expectedState: string;
  actualState: string | null;
  gateRequired: boolean;
  completionPolicy: LifecycleModuleDTO["completionPolicy"];
  riskLevel: LifecycleModuleDTO["riskLevel"];
  status: ModuleStatus;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): LifecycleModuleDTO {
  return {
    id: module.id,
    runId: module.runId,
    moduleOrder: module.moduleOrder,
    moduleType: module.moduleType,
    title: module.title,
    description: module.description,
    config: module.config ?? null,
    expectedState: module.expectedState,
    actualState: module.actualState,
    gateRequired: module.gateRequired,
    completionPolicy: module.completionPolicy,
    riskLevel: module.riskLevel,
    status: module.status,
    lastError: module.lastError,
    createdAt: module.createdAt.toISOString(),
    updatedAt: module.updatedAt.toISOString(),
    startedAt: module.startedAt ? module.startedAt.toISOString() : null,
    completedAt: module.completedAt ? module.completedAt.toISOString() : null,
  };
}

function toTransitionDTO(transition: {
  id: string;
  runId: string;
  fromStatus: RunStatus;
  toStatus: RunStatus;
  reason: string;
  metadata: unknown;
  createdAt: Date;
}): LifecycleTransitionDTO {
  return {
    id: transition.id,
    runId: transition.runId,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    reason: transition.reason,
    metadata: transition.metadata ?? null,
    createdAt: transition.createdAt.toISOString(),
  };
}

function toEvidenceDTO(evidence: {
  id: string;
  runId: string;
  moduleId: string | null;
  kind: string;
  summary: string;
  details: unknown;
  createdAt: Date;
}): LifecycleEvidenceDTO {
  return {
    id: evidence.id,
    runId: evidence.runId,
    moduleId: evidence.moduleId,
    kind: evidence.kind,
    summary: evidence.summary,
    details: evidence.details ?? null,
    createdAt: evidence.createdAt.toISOString(),
  };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

const PREPHASE_REVIEW_MARKER_START = "[[PREPHASE_REVIEW_START]]";
const PREPHASE_REVIEW_MARKER_END = "[[PREPHASE_REVIEW_END]]";

function stripPrephaseReviewBlock(value: string | null): string {
  if (!value) {
    return "";
  }
  const strictPattern = new RegExp(
    `${PREPHASE_REVIEW_MARKER_START}[\\s\\S]*?${PREPHASE_REVIEW_MARKER_END}\\n?`,
    "g",
  );
  const loosePattern = /\[\[PREPHASE_REVIEW_[A-Z_]*\]\][\s\S]*?\[\[PREPHASE_REVIEW_END\]\]\n?/g;
  const cleaned = value
    .replace(strictPattern, "")
    .replace(loosePattern, "")
    .replace(/^\[\[PREPHASE_REVIEW_[A-Z_]*\]\]\s*$/gm, "")
    .replace(/^\[\[PREPHASE_REVIEW_[A-Z_]*\]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned;
}

function isTerminalModuleStatus(status: ModuleStatus): boolean {
  return status === "COMPLETED" || status === "SKIPPED";
}

function assertModuleOrder(modules: CreateLifecycleRunInput["modules"]) {
  const sorted = [...modules].sort((a, b) => a.moduleOrder - b.moduleOrder);
  const seen = new Set<number>();
  for (let index = 0; index < sorted.length; index += 1) {
    const moduleEntry = sorted[index];
    if (!moduleEntry) continue;
    if (seen.has(moduleEntry.moduleOrder)) {
      throw new ValidationError("modules must use unique moduleOrder values");
    }
    seen.add(moduleEntry.moduleOrder);
    const expected = index + 1;
    if (moduleEntry.moduleOrder !== expected) {
      throw new ValidationError(`modules must be contiguous and start at 1 (expected moduleOrder ${expected})`);
    }
  }
}

function assertQualityGateBeforeInfra(modules: CreateLifecycleRunInput["modules"]) {
  const sorted = [...modules].sort((a, b) => a.moduleOrder - b.moduleOrder);
  const firstCheck = sorted.find((module) => module.moduleType === "CHECK");
  const firstDomain = sorted.find((module) => module.moduleType === "DOMAIN");
  const firstDeploy = sorted.find((module) => module.moduleType === "DEPLOY");

  if ((firstDomain || firstDeploy) && !firstCheck) {
    throw new ValidationError("Lifecycle run requires CHECK module before DOMAIN/DEPLOY modules");
  }

  if (firstCheck && firstDomain && firstCheck.moduleOrder > firstDomain.moduleOrder) {
    throw new ValidationError("CHECK module must run before DOMAIN module");
  }

  if (firstCheck && firstDeploy && firstCheck.moduleOrder > firstDeploy.moduleOrder) {
    throw new ValidationError("CHECK module must run before DEPLOY module");
  }
}

function assertBirthCoreModules(input: CreateLifecycleRunInput) {
  if ((input.classification ?? "BIRTH") !== "BIRTH") {
    return;
  }
  const types = new Set(input.modules.map((module) => module.moduleType));
  const required: ModuleType[] = ["TECHSTACK", "CHECK", "DOMAIN", "DEPLOY"];
  const missing = required.filter((type) => !types.has(type));
  if (missing.length > 0) {
    throw new ValidationError(`BIRTH lifecycle run is missing required module types: ${missing.join(", ")}`);
  }
}

async function assertProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    throw new NotFoundError("Project not found");
  }
}

async function createTransition(runId: string, fromStatus: RunStatus, toStatus: RunStatus, reason: string) {
  if (fromStatus === toStatus) {
    return;
  }

  await prisma.lifecycleTransition.create({
    data: {
      runId,
      fromStatus,
      toStatus,
      reason,
    },
  });
}

async function loadRunForProject(projectId: string, runId: string) {
  const run = await prisma.lifecycleRun.findFirst({
    where: { id: runId, projectId },
    include: {
      modules: { orderBy: { moduleOrder: "asc" } },
      transitions: { orderBy: { createdAt: "asc" } },
      evidences: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) {
    throw new NotFoundError("Lifecycle run not found");
  }
  return run;
}

function toRunDetailDTO(run: Awaited<ReturnType<typeof loadRunForProject>>): LifecycleRunDetailDTO {
  return {
    run: toRunDTO(run),
    modules: run.modules.map(toModuleDTO),
    transitions: run.transitions.map(toTransitionDTO),
    evidences: run.evidences.map(toEvidenceDTO),
  };
}

export async function listLifecycleRunsByProject(projectId: string): Promise<LifecycleRunDTO[]> {
  await assertProjectExists(projectId);
  const runs = await prisma.lifecycleRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return runs.map(toRunDTO);
}

export async function getLifecycleRunDetail(projectId: string, runId: string): Promise<LifecycleRunDetailDTO> {
  const run = await loadRunForProject(projectId, runId);
  return toRunDetailDTO(run);
}

export async function deleteLifecycleRun(projectId: string, runId: string): Promise<void> {
  const run = await prisma.lifecycleRun.findFirst({
    where: { id: runId, projectId },
    select: { id: true, status: true },
  });
  if (!run) {
    throw new NotFoundError("Lifecycle run not found");
  }

  if (run.status === "RUNNING") {
    throw new ValidationError("Cannot delete a RUNNING lifecycle run. Stop/cancel it first.");
  }

  await prisma.lifecycleRun.delete({
    where: { id: run.id },
  });
  await touchProjectUpdatedAt(projectId);
}

export async function createLifecycleRun(projectId: string, input: CreateLifecycleRunInput): Promise<LifecycleRunDetailDTO> {
  await assertProjectExists(projectId);
  assertModuleOrder(input.modules);
  assertQualityGateBeforeInfra(input.modules);
  assertBirthCoreModules(input);

  const mode = input.mode ?? "STEP";
  const classification = input.classification ?? "BIRTH";
  const created = await prisma.$transaction(async (tx) => {
    const run = await tx.lifecycleRun.create({
      data: {
        projectId,
        title: input.title,
        mode,
        status: "DRAFT",
        classification,
      },
    });

    const sortedModules = [...input.modules].sort((a, b) => a.moduleOrder - b.moduleOrder);
    const modules = await Promise.all(
      sortedModules.map((module) =>
        tx.lifecycleModule.create({
          data: {
            runId: run.id,
            moduleOrder: module.moduleOrder,
            moduleType: module.moduleType,
            title: module.title,
            description: module.description,
            config: toJsonInput(module.config),
            expectedState: module.expectedState,
            gateRequired: module.gateRequired ?? module.moduleType === "CHECK",
            completionPolicy:
              module.completionPolicy ??
              (mode === "STEP" ? "PAUSE_ALWAYS" : module.riskLevel === "HIGH" ? "PAUSE_ON_RISK" : "CONTINUE_AUTOMATIC"),
            riskLevel: module.riskLevel ?? "MEDIUM",
            status: "PENDING",
          },
        }),
      ),
    );

    return {
      ...run,
      modules,
      transitions: [],
      evidences: [],
    };
  });

  await touchProjectUpdatedAt(projectId);
  return toRunDetailDTO(created);
}

export async function resumeLifecycleRun(
  projectId: string,
  runId: string,
  input: ResumeLifecycleRunInput,
): Promise<LifecycleRunDetailDTO> {
  const run = await loadRunForProject(projectId, runId);
  if (!["READY", "BLOCKED"].includes(run.status)) {
    throw new ValidationError(`Run cannot be resumed from status ${run.status}`);
  }

  const nextPending = run.modules.find((module) => module.status === "PENDING" || module.status === "BLOCKED");
  if (!nextPending) {
    throw new ValidationError("Run has no pending module to resume");
  }

  await prisma.$transaction(async (tx) => {
    await tx.lifecycleModule.update({
      where: { id: nextPending.id },
      data: {
        status: "RUNNING",
        startedAt: nextPending.startedAt ?? new Date(),
      },
    });

    await tx.lifecycleRun.update({
      where: { id: run.id },
      data: {
        status: "RUNNING",
        startedAt: run.startedAt ?? new Date(),
        finishedAt: null,
      },
    });
  });

  await createTransition(run.id, run.status, "RUNNING", input.reason ?? "Operator resumed lifecycle run");
  await touchProjectUpdatedAt(projectId);
  return getLifecycleRunDetail(projectId, runId);
}

export async function startLifecycleBuild(projectId: string, runId: string): Promise<LifecycleRunDetailDTO> {
  const run = await loadRunForProject(projectId, runId);
  if (run.status !== "DRAFT") {
    throw new ValidationError(`Lifecycle build can only start from DRAFT status (current: ${run.status})`);
  }

  const firstModule = run.modules.find((entry) => entry.status === "PENDING" || entry.status === "BLOCKED");
  if (!firstModule) {
    throw new ValidationError("Lifecycle run has no pending module to start");
  }

  await prisma.$transaction(async (tx) => {
    await tx.lifecycleRun.update({
      where: { id: runId },
      data: {
        status: "RUNNING",
        startedAt: run.startedAt ?? new Date(),
        finishedAt: null,
      },
    });
    await tx.lifecycleModule.update({
      where: { id: firstModule.id },
      data: {
        status: "RUNNING",
        startedAt: firstModule.startedAt ?? new Date(),
      },
    });
  });

  await createTransition(runId, "DRAFT", "RUNNING", "Operator pressed start build");
  await touchProjectUpdatedAt(projectId);
  return getLifecycleRunDetail(projectId, runId);
}

export async function updateLifecycleModuleStatus(
  projectId: string,
  runId: string,
  moduleId: string,
  input: UpdateLifecycleModuleInput,
): Promise<LifecycleRunDetailDTO> {
  const detail = await loadRunForProject(projectId, runId);
  const moduleEntry = detail.modules.find((entry) => entry.id === moduleId);
  if (!moduleEntry) {
    throw new NotFoundError("Lifecycle module not found");
  }

  const sortedModules = detail.modules;
  const currentIndex = sortedModules.findIndex((entry) => entry.id === moduleId);
  const previous = currentIndex > 0 ? sortedModules[currentIndex - 1] : null;

  if (previous && !isTerminalModuleStatus(previous.status) && input.status !== "SKIPPED") {
    throw new ValidationError("Cannot update module before previous module reaches a terminal status");
  }

  await prisma.$transaction(async (tx) => {
    await tx.lifecycleModule.update({
      where: { id: moduleEntry.id },
      data: {
        status: input.status,
        actualState: input.actualState ?? moduleEntry.actualState,
        lastError: input.lastError ?? (input.status === "FAILED" ? moduleEntry.lastError ?? "Module failed" : null),
        startedAt:
          input.status === "RUNNING"
            ? moduleEntry.startedAt ?? new Date()
            : input.status === "PENDING" || input.status === "BLOCKED"
              ? null
              : moduleEntry.startedAt,
        completedAt:
          input.status === "COMPLETED" || input.status === "SKIPPED" || input.status === "FAILED"
            ? new Date()
            : null,
      },
    });

    if (input.evidence) {
      await tx.lifecycleEvidence.create({
        data: {
          runId,
          moduleId,
          kind: input.evidence.kind,
          summary: input.evidence.summary,
          details: toJsonInput(input.evidence.details),
        },
      });
    }
  });

  const latest = await loadRunForProject(projectId, runId);

  let nextRunStatus: RunStatus = latest.status;
  if (latest.modules.some((entry) => entry.status === "FAILED")) {
    nextRunStatus = "FAILED";
  } else {
    const pending = latest.modules.find((entry) => entry.status === "PENDING" || entry.status === "BLOCKED");
    const running = latest.modules.find((entry) => entry.status === "RUNNING");
    const allTerminal = latest.modules.every((entry) => isTerminalModuleStatus(entry.status));

    if (allTerminal) {
      nextRunStatus = latest.modules.some((entry) => entry.moduleType === "DEPLOY" && entry.status === "COMPLETED")
        ? "DEPLOYED"
        : "VERIFIED";
    } else if (running) {
      nextRunStatus = "RUNNING";
    } else if (pending) {
      const shouldPauseForStep = latest.mode === "STEP";

      if (shouldPauseForStep) {
        nextRunStatus = "BLOCKED";
        await prisma.lifecycleModule.update({
          where: { id: pending.id },
          data: { status: "BLOCKED" },
        });
      } else {
        nextRunStatus = "RUNNING";
        await prisma.lifecycleModule.update({
          where: { id: pending.id },
          data: { status: "RUNNING", startedAt: pending.startedAt ?? new Date() },
        });
      }
    } else {
      nextRunStatus = "READY";
    }
  }

  if (nextRunStatus !== latest.status) {
    const nextClassification =
      nextRunStatus === "DEPLOYED" ? "DEPLOYED" : latest.classification;
    await prisma.lifecycleRun.update({
      where: { id: runId },
      data: {
        status: nextRunStatus,
        classification: nextClassification,
        finishedAt:
          nextRunStatus === "DEPLOYED" || nextRunStatus === "VERIFIED" || nextRunStatus === "FAILED"
            ? new Date()
            : null,
      },
    });
    await createTransition(
      runId,
      latest.status,
      nextRunStatus,
      `Module ${moduleEntry.moduleOrder} status changed to ${input.status}`,
    );
  }

  await touchProjectUpdatedAt(projectId);
  return getLifecycleRunDetail(projectId, runId);
}

export async function appendLifecycleModule(
  projectId: string,
  runId: string,
  input: AppendLifecycleModuleInput,
): Promise<LifecycleRunDetailDTO> {
  const run = await loadRunForProject(projectId, runId);
  if (run.status !== "DEPLOYED" && run.classification !== "DEPLOYED") {
    throw new ValidationError("Modules can only be appended when lifecycle is deployment-classified");
  }

  const nextOrder = run.modules.reduce((max, entry) => Math.max(max, entry.moduleOrder), 0) + 1;
  const expectedState =
    input.moduleType === "CHANGE"
      ? "Requested change is implemented and validated."
      : input.moduleType === "FIX"
        ? "Reported issue is fixed and validated."
        : "Teardown executed with verified cleanup and audit evidence.";

  await prisma.$transaction(async (tx) => {
    await tx.lifecycleModule.create({
      data: {
        runId,
        moduleOrder: nextOrder,
        moduleType: input.moduleType,
        title: input.title,
        description: input.description,
        expectedState,
        gateRequired: false,
        completionPolicy: run.mode === "STEP" ? "PAUSE_ALWAYS" : "PAUSE_ON_RISK",
        riskLevel: input.riskLevel ?? "MEDIUM",
        status: "PENDING",
      },
    });

    if (run.status !== "READY") {
      await tx.lifecycleRun.update({
        where: { id: runId },
        data: {
          status: "READY",
          finishedAt: null,
        },
      });
    }

    await tx.lifecycleEvidence.create({
      data: {
        runId,
        kind: "OPERATOR_APPEND_MODULE",
        summary: `Appended ${input.moduleType} module #${nextOrder}`,
        details: toJsonInput({
          moduleOrder: nextOrder,
          moduleType: input.moduleType,
          title: input.title,
        }),
      },
    });
  });

  if (run.status !== "READY") {
    await createTransition(runId, run.status, "READY", `Operator appended ${input.moduleType} module`);
  }
  await touchProjectUpdatedAt(projectId);
  return getLifecycleRunDetail(projectId, runId);
}

export async function upsertLifecycleModulePrephaseReview(
  projectId: string,
  runId: string,
  moduleId: string,
  input: UpsertLifecycleModulePrephaseReviewInput,
): Promise<LifecycleRunDetailDTO> {
  const detail = await loadRunForProject(projectId, runId);
  const moduleEntry = detail.modules.find((entry) => entry.id === moduleId);
  if (!moduleEntry) {
    throw new NotFoundError("Lifecycle module not found");
  }

  const timestamp = new Date().toISOString();
  const prephaseBlock = [
    PREPHASE_REVIEW_MARKER_START,
    `# PREPHASE REVIEW (${timestamp})`,
    input.content.trim(),
    PREPHASE_REVIEW_MARKER_END,
  ].join("\n");
  const preserved = stripPrephaseReviewBlock(moduleEntry.actualState);
  const nextActualState = [preserved, prephaseBlock].filter(Boolean).join("\n\n");

  await prisma.$transaction(async (tx) => {
    await tx.lifecycleModule.update({
      where: { id: moduleId },
      data: {
        actualState: nextActualState,
      },
    });

    await tx.lifecycleEvidence.create({
      data: {
        runId,
        moduleId,
        kind: "PREPHASE_REVIEW",
        summary: "Prephase review captured in module actualState",
        details: toJsonInput({
          timestamp,
          runId,
          moduleId,
          source: "COPM_AGENT",
        }),
      },
    });
  });

  return getLifecycleRunDetail(projectId, runId);
}

export async function updateLifecycleModuleDefinition(
  projectId: string,
  runId: string,
  moduleId: string,
  input: UpdateLifecycleModuleDefinitionInput,
): Promise<LifecycleRunDetailDTO> {
  const detail = await loadRunForProject(projectId, runId);
  const moduleEntry = detail.modules.find((entry) => entry.id === moduleId);
  if (!moduleEntry) {
    throw new NotFoundError("Lifecycle module not found");
  }

  await prisma.$transaction(async (tx) => {
    const updateData: Prisma.LifecycleModuleUpdateInput = {
      moduleType: input.moduleType ?? moduleEntry.moduleType,
      title: input.title ?? moduleEntry.title,
      description: input.description ?? moduleEntry.description,
      expectedState: input.expectedState ?? moduleEntry.expectedState,
      gateRequired: input.gateRequired ?? moduleEntry.gateRequired,
      riskLevel: input.riskLevel ?? moduleEntry.riskLevel,
    };
    if (input.config !== undefined) {
      updateData.config = toJsonInput(input.config) ?? Prisma.JsonNull;
    }

    await tx.lifecycleModule.update({
      where: { id: moduleId },
      data: updateData,
    });

    await tx.lifecycleEvidence.create({
      data: {
        runId,
        moduleId,
        kind: "OPERATOR_MODULE_EDIT",
        summary: "Module definition updated by operator",
        details: toJsonInput({
          updatedFields: Object.keys(input),
          source: "COPM_ADMIN_UI",
        }),
      },
    });
  });

  await touchProjectUpdatedAt(projectId);
  return getLifecycleRunDetail(projectId, runId);
}
