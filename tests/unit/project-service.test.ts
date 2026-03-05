import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { teardownMock } = vi.hoisted(() => ({
  teardownMock: vi.fn().mockResolvedValue({
    projectId: "p1",
    deleted: false,
    hostId: null,
    status: "DISABLED",
  }),
}));

vi.mock("@/lib/services/domnex-provisioning-service", () => ({
  teardownDomNexProject: teardownMock,
}));

import { createProject, deleteProject, getProjectById, listProjects, updateProject } from "@/lib/services/project-service";

const fullProject = {
  id: "p1",
  visualId: "PRJ-0001",
  name: "Test",
  target: "Target text",
  autonomousAgentEnabled: false,
  autoProvisionDomain: false,
  provisionStatus: "DISABLED",
  provisionError: null,
  fqdn: null,
  domnexHostId: null,
  provisionUpstreamUrl: null,
  provisionInsecureTls: false,
  provisionHaEnabled: false,
  provisionedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("project-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists projects", async () => {
    prismaMock.project.findMany.mockResolvedValue([fullProject]);

    const result = await listProjects();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("p1");
  });

  it("gets project by id", async () => {
    prismaMock.project.findUnique.mockResolvedValue(fullProject);

    const result = await getProjectById("p1");
    expect(result.id).toBe("p1");
  });

  it("creates project", async () => {
    prismaMock.project.create.mockResolvedValue(fullProject);

    const result = await createProject({ name: "Test", target: "Target text", createdByUserId: "u1" });
    expect(result.name).toBe("Test");
  });

  it("updates project", async () => {
    prismaMock.project.findUnique.mockResolvedValue(fullProject);
    prismaMock.project.update.mockResolvedValue({
      ...fullProject,
      name: "Updated",
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const result = await updateProject("p1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("deletes project", async () => {
    prismaMock.project.findUnique.mockResolvedValue(fullProject);
    prismaMock.project.delete.mockResolvedValue({ id: "p1" });

    const result = await deleteProject("p1");
    expect(result.id).toBe("p1");
    expect(teardownMock).not.toHaveBeenCalled();
  });

  it("deletes project with domnex teardown when provisioning data exists", async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...fullProject,
      autoProvisionDomain: true,
      fqdn: "prj-0001.example.com",
    });
    prismaMock.project.delete.mockResolvedValue({ id: "p1" });

    const result = await deleteProject("p1");
    expect(result.id).toBe("p1");
    expect(teardownMock).toHaveBeenCalledWith({
      projectId: "p1",
      clearFqdn: false,
      reason: "project-delete",
      initiatedBy: "system",
    });
  });
});
