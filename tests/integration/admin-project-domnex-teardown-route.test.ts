import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/projects/[id]/domnex/teardown/route";

const { teardownMock } = vi.hoisted(() => ({
  teardownMock: vi.fn().mockResolvedValue({
    projectId: "p1",
    deleted: true,
    hostId: "host_123",
    deletedDocumentationCount: 4,
    workspaceCleared: true,
    status: "DISABLED",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN", email: "admin@example.com" } }),
}));

vi.mock("@/lib/services/domnex-provisioning-service", () => ({
  teardownDomNexProject: teardownMock,
}));

describe("/api/v1/admin/projects/:id/domnex/teardown", () => {
  it("POST runs domnex teardown", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/domnex/teardown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clearFqdn: true, clearDocumentation: true, clearWorkspace: true }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(teardownMock).toHaveBeenCalledWith({
      projectId: "p1",
      clearFqdn: true,
      clearDocumentation: true,
      clearWorkspace: true,
      reason: "manual-teardown",
      initiatedBy: "admin@example.com",
    });
  });
});
