import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/projects/[id]/domnex/provision/route";

const { provisionMock } = vi.hoisted(() => ({
  provisionMock: vi.fn().mockResolvedValue({
    queued: true,
    projectId: "p1",
    fqdn: "prj-0001.example.com",
    upstreamUrl: "http://192.168.1.100:4556",
    status: "PENDING",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/domnex-provisioning-service", () => ({
  queueDomNexProvisionForProject: provisionMock,
}));

describe("/api/v1/admin/projects/:id/domnex/provision", () => {
  it("POST provisions domnex host", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/domnex/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fqdn: "prj-0001.example.com",
        upstreamUrl: "http://192.168.1.100:4556",
      }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(202);
    expect(provisionMock).toHaveBeenCalledWith("p1", expect.any(Object));
  });
});
