import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/services/project-service", () => ({
  touchProjectUpdatedAt: vi.fn().mockResolvedValue(undefined),
}));

import { createTask, listTasksByProject, updateTask } from "@/lib/services/task-service";

describe("task-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tasks by project", async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1" });
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "t1",
        projectId: "p1",
        title: "Task",
        executionOrder: 1,
        status: "ACTIVE",
        requiresOperatorFeedback: false,
        istState: "A",
        sollState: "B",
        technicalPlan: "C",
        riskImpact: "D",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const tasks = await listTasksByProject("p1");
    expect(tasks).toHaveLength(1);
  });

  it("blocks task creation in vNext replacement mode", async () => {
    await expect(
      createTask("p1", {
        title: "Task",
        istState: "A",
        sollState: "B",
        technicalPlan: "C",
        riskImpact: "D",
      }),
    ).rejects.toThrow("Task writes are disabled in vNext");
  });

  it("blocks task updates in vNext replacement mode", async () => {
    await expect(updateTask("t1", { status: "DONE", title: "Task updated" })).rejects.toThrow(
      "Task writes are disabled in vNext",
    );
  });

  it("does not execute persistence when task writes are blocked", async () => {
    await expect(updateTask("t2", { status: "DONE" })).rejects.toThrow("Task writes are disabled in vNext");
    expect(prismaMock.task.update).not.toHaveBeenCalled();
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});
