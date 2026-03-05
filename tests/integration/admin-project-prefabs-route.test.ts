import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/projects/[id]/prefabs/route";

const { applyPrefabMock } = vi.hoisted(() => ({
  applyPrefabMock: vi.fn().mockResolvedValue({
    taskId: "t1",
    documentationId: "d1",
    type: "GITHUB_RELEASE",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/prefab-task-service", () => ({
  applyPrefabToProject: applyPrefabMock,
}));

describe("/api/v1/admin/projects/:id/prefabs", () => {
  it("POST applies prefab", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/prefabs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "GITHUB_RELEASE",
        repoUrl: "https://github.com/org/repo.git",
      }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(201);
    expect(applyPrefabMock).toHaveBeenCalledWith({
      projectId: "p1",
      type: "GITHUB_RELEASE",
      repoUrl: "https://github.com/org/repo.git",
      fqdn: undefined,
      upstreamUrl: undefined,
      executionOrder: undefined,
    });
  });
});
