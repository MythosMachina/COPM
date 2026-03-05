import { describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/v1/admin/projects/[id]/domnex/route";

const { toggleMock } = vi.hoisted(() => ({
  toggleMock: vi.fn().mockResolvedValue({
    projectId: "p1",
    autoProvisionDomain: true,
    provisionStatus: "PENDING",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/domnex-provisioning-service", () => ({
  setProjectDomNexAutoProvision: toggleMock,
}));

describe("/api/v1/admin/projects/:id/domnex", () => {
  it("PATCH toggles auto provisioning", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/domnex", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    const response = await PATCH(request, { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(toggleMock).toHaveBeenCalledWith("p1", true);
  });
});
