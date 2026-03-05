import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    documentation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/services/project-service", () => ({
  touchProjectUpdatedAt: vi.fn().mockResolvedValue(undefined),
}));

import {
  createDocumentation,
  listDocumentationByProject,
  updateDocumentation,
} from "@/lib/services/documentation-service";

describe("documentation-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists documentation", async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1" });
    prismaMock.documentation.findMany.mockResolvedValue([
      {
        id: "d1",
        projectId: "p1",
        name: "Setup",
        content: "# Setup",
        version: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const result = await listDocumentationByProject("p1");
    expect(result).toHaveLength(1);
  });

  it("creates documentation with incremented version", async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1" });
    prismaMock.documentation.findFirst.mockResolvedValue({ version: 2 });
    prismaMock.documentation.create.mockResolvedValue({
      id: "d3",
      projectId: "p1",
      name: "Setup",
      content: "# Setup",
      version: 3,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await createDocumentation("p1", { name: "Setup", content: "# Setup" });
    expect(result.version).toBe(3);
  });

  it("updates documentation by creating next version", async () => {
    prismaMock.documentation.findUnique.mockResolvedValue({
      id: "d1",
      projectId: "p1",
      name: "Setup",
      content: "old",
      version: 4,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    prismaMock.documentation.create.mockResolvedValue({
      id: "d2",
      projectId: "p1",
      name: "Setup",
      content: "new",
      version: 5,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await updateDocumentation("d1", { content: "new" });
    expect(result.version).toBe(5);
  });
});
