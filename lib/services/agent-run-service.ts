import type { AgentRun, AgentRunStatus } from "@prisma/client";
import { ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import type { AgentRunSummary } from "@/lib/orchestrator/types";

function toSummary(run: AgentRun): AgentRunSummary {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
    trigger: run.trigger,
    workspacePath: run.workspacePath,
    command: run.command,
    promptPath: run.promptPath,
    pid: run.pid,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    exitCode: run.exitCode,
    failureReason: run.failureReason,
    heartbeatAt: run.heartbeatAt ? run.heartbeatAt.toISOString() : null,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function listAgentRuns(projectId?: string): Promise<AgentRunSummary[]> {
  const runs = await prisma.agentRun.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return runs.map(toSummary);
}

export async function getLatestAgentRun(projectId: string): Promise<AgentRunSummary | null> {
  const run = await prisma.agentRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return run ? toSummary(run) : null;
}

export async function hasBlockingRun(projectId: string): Promise<boolean> {
  const count = await prisma.agentRun.count({
    where: {
      projectId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  return count > 0;
}

export async function createAgentRun(input: {
  projectId: string;
  trigger: string;
  workspacePath: string;
  command: string;
  promptPath: string;
}): Promise<AgentRunSummary> {
  const run = await prisma.$transaction(async (tx) => {
    // Serialize run creation per project across worker processes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.projectId}))`;

    const blocking = await tx.agentRun.findFirst({
      where: {
        projectId: input.projectId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    });
    if (blocking) {
      throw new ValidationError("Blocking agent run already exists for project");
    }

    return await tx.agentRun.create({
      data: {
        projectId: input.projectId,
        trigger: input.trigger,
        workspacePath: input.workspacePath,
        command: input.command,
        promptPath: input.promptPath,
        status: "QUEUED",
      },
    });
  });

  return toSummary(run);
}

export async function markAgentRunRunning(runId: string, pid: number) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      pid,
      startedAt: new Date(),
      heartbeatAt: new Date(),
      failureReason: null,
      exitCode: null,
      finishedAt: null,
    },
  });
}

export async function heartbeatAgentRun(runId: string) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { heartbeatAt: new Date() },
  });
}

export async function finishAgentRun(input: {
  runId: string;
  status: AgentRunStatus;
  exitCode?: number | null;
  failureReason?: string | null;
  summary?: string | null;
}) {
  await prisma.agentRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      exitCode: input.exitCode ?? null,
      failureReason: input.failureReason ?? null,
      summary: input.summary ?? null,
      finishedAt: new Date(),
      heartbeatAt: new Date(),
    },
  });
}

export async function markStaleRunningRunsFailed(maxAgeMinutes: number) {
  const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  await prisma.agentRun.updateMany({
    where: {
      status: "RUNNING",
      OR: [{ heartbeatAt: { lt: threshold } }, { heartbeatAt: null }],
    },
    data: {
      status: "FAILED",
      failureReason: "Worker restart detected stale RUNNING state",
      finishedAt: new Date(),
      heartbeatAt: new Date(),
    },
  });
}

function parseFrontmatterMeta(content: string): Record<string, string> {
  const lines = content.replace(/\r/g, "").split("\n");
  if (lines[0]?.trim() !== "---") {
    return {};
  }

  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (end === -1) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      result[key] = value;
    }
  }

  return result;
}

export async function resetAgentProject(projectId: string): Promise<{
  canceledRuns: number;
  killedPids: number;
  resolvedQuestions: number;
}> {
  const activeRuns = await prisma.agentRun.findMany({
    where: {
      projectId,
      status: { in: ["RUNNING", "QUEUED", "WAITING_INPUT"] },
    },
    select: { id: true, pid: true },
  });

  let killedPids = 0;
  for (const run of activeRuns) {
    if (!run.pid || run.pid <= 0) {
      continue;
    }

    try {
      process.kill(run.pid, "SIGTERM");
      killedPids += 1;
    } catch {
      // Ignore if process is already gone or not killable from this process.
    }
  }

  const canceled = await prisma.agentRun.updateMany({
    where: {
      projectId,
      status: { in: ["RUNNING", "QUEUED", "WAITING_INPUT"] },
    },
    data: {
      status: "CANCELED",
      failureReason: "Reset by admin (autonomous agent disabled)",
      finishedAt: new Date(),
      heartbeatAt: new Date(),
    },
  });

  const qaDocs = await prisma.documentation.findMany({
    where: {
      projectId,
      OR: [{ name: { startsWith: "QA:QUESTION:" } }, { name: { startsWith: "QA:ANSWER:" } }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      content: true,
    },
  });

  const answeredQuestionIds = new Set<string>();
  const questionIdsInOrder: string[] = [];
  for (const doc of qaDocs) {
    if (doc.name.startsWith("QA:ANSWER:")) {
      const answerId = doc.name.replace("QA:ANSWER:", "").trim();
      if (answerId) {
        answeredQuestionIds.add(answerId);
      }
      continue;
    }

    if (!doc.name.startsWith("QA:QUESTION:")) {
      continue;
    }

    const meta = parseFrontmatterMeta(doc.content);
    const questionId = (meta.questionId ?? doc.name.replace("QA:QUESTION:", "").trim()).trim();
    if (questionId) {
      questionIdsInOrder.push(questionId);
    }
  }

  let resolvedQuestions = 0;
  for (const questionId of questionIdsInOrder) {
    if (answeredQuestionIds.has(questionId)) {
      continue;
    }

    const answerName = `QA:ANSWER:${questionId}`;
    const latestAnswer = await prisma.documentation.findFirst({
      where: { projectId, name: answerName },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await prisma.documentation.create({
      data: {
        projectId,
        name: answerName,
        version: (latestAnswer?.version ?? 0) + 1,
        content: [
          "---",
          "kind: ANSWER",
          `questionId: ${questionId}`,
          "source: COPM_ADMIN_RESET",
          "---",
          "",
          "Autonomous agent was disabled by admin. Pending question was closed during reset.",
        ].join("\n"),
      },
    });
    resolvedQuestions += 1;
  }

  return {
    canceledRuns: canceled.count,
    killedPids,
    resolvedQuestions,
  };
}
