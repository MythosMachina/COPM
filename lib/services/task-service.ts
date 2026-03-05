import type { Task } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { touchProjectUpdatedAt } from "@/lib/services/project-service";
import type { TaskDTO } from "@/types/domain";

type CreateTaskInput = {
  title: string;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
  requiresOperatorFeedback?: boolean;
  executionOrder?: number;
};

type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: "ACTIVE" | "DONE";
};

function assertTaskWriteEnabled() {
  throw new ValidationError(
    "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
  );
}

function normalizeTaskText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function isProvisioningExecutionTask(input: {
  title: string;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
}): boolean {
  const content = normalizeTaskText(
    [input.title, input.istState, input.sollState, input.technicalPlan, input.riskImpact].filter(Boolean).join("\n"),
  );

  const teardownMarkers = ["teardown", "rueckbau", "rollback", "remove domain", "delete domain"];
  if (teardownMarkers.some((pattern) => content.includes(pattern))) {
    return false;
  }

  const provisioningMarkers = [
    "domnex",
    "provisioning",
    "provision",
    "subdomain",
    "fqdn",
    "domain host",
    "domain setup",
  ];

  return provisioningMarkers.some((pattern) => content.includes(pattern));
}

function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    visualId: task.visualId,
    projectId: task.projectId,
    title: task.title,
    executionOrder: task.executionOrder,
    status: task.status,
    requiresOperatorFeedback: task.requiresOperatorFeedback,
    istState: task.istState,
    sollState: task.sollState,
    technicalPlan: task.technicalPlan,
    riskImpact: task.riskImpact,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function listTasksByProject(projectId: string): Promise<TaskDTO[]> {
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { executionOrder: "asc" }, { updatedAt: "desc" }],
  });

  return tasks.map(toTaskDTO);
}

export async function getTaskById(id: string): Promise<TaskDTO> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return toTaskDTO(task);
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<TaskDTO> {
  assertTaskWriteEnabled();
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  try {
    const maxOrder = await prisma.task.aggregate({
      where: { projectId },
      _max: { executionOrder: true },
    });
    const nextOrder = (maxOrder._max.executionOrder ?? 0) + 1;

    const task = await prisma.task.create({
      data: {
        projectId,
        ...input,
        executionOrder: input.executionOrder ?? nextOrder,
        requiresOperatorFeedback: input.requiresOperatorFeedback ?? false,
      },
    });

    await touchProjectUpdatedAt(projectId);

    return toTaskDTO(task);
  } catch (error) {
    throw new ValidationError("Unable to create task", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO> {
  assertTaskWriteEnabled();
  const existing = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      title: true,
      istState: true,
      sollState: true,
      technicalPlan: true,
      riskImpact: true,
      project: {
        select: {
          provisionStatus: true,
        },
      },
    },
  });
  if (!existing) {
    throw new NotFoundError("Task not found");
  }

  if (input.status === "DONE") {
    const effectiveTask = {
      title: input.title ?? existing.title,
      istState: input.istState ?? existing.istState,
      sollState: input.sollState ?? existing.sollState,
      technicalPlan: input.technicalPlan ?? existing.technicalPlan,
      riskImpact: input.riskImpact ?? existing.riskImpact,
    };

    if (isProvisioningExecutionTask(effectiveTask) && existing.project.provisionStatus !== "READY") {
      throw new ValidationError(
        `Provisioning task cannot be marked DONE while project provisioning status is ${existing.project.provisionStatus}. Resolve preflight and upstream reachability first.`,
      );
    }
  }

  try {
    const task = await prisma.task.update({
      where: { id },
      data: input,
    });

    await touchProjectUpdatedAt(existing.projectId);

    return toTaskDTO(task);
  } catch (error) {
    throw new ValidationError("Unable to update task", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function deleteTask(id: string): Promise<{ id: string }> {
  assertTaskWriteEnabled();
  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true, projectId: true } });
  if (!existing) {
    throw new NotFoundError("Task not found");
  }

  try {
    await prisma.task.delete({ where: { id } });
    await touchProjectUpdatedAt(existing.projectId);
    return { id };
  } catch (error) {
    throw new ValidationError("Unable to delete task", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function deleteTasksByProject(
  projectId: string,
  status?: "ACTIVE" | "DONE",
): Promise<{ deletedCount: number }> {
  assertTaskWriteEnabled();
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  try {
    const result = await prisma.task.deleteMany({
      where: {
        projectId,
        ...(status ? { status } : {}),
      },
    });

    if (result.count > 0) {
      await touchProjectUpdatedAt(projectId);
    }

    return { deletedCount: result.count };
  } catch (error) {
    throw new ValidationError("Unable to delete project tasks", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}
