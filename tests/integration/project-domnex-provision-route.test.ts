import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/projects/[id]/domnex/provision/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

const { provisionMock } = vi.hoisted(() => ({
  provisionMock: vi.fn().mockResolvedValue({
    queued: true,
    projectId: "p1",
    fqdn: "prj-0001.example.com",
    upstreamUrl: "http://192.168.1.100:4556",
    status: "PENDING",
  }),
}));

vi.mock("@/lib/services/domnex-provisioning-service", () => ({
  queueDomNexProvisionForProject: provisionMock,
}));

describe("/api/v1/projects/:id/domnex/provision", () => {
  it("POST queues domnex provisioning with bearer token", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/domnex/provision", {
      method: "POST",
      headers: { "content-type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify({
        upstreamUrl: "http://192.168.1.100:4556",
      }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(202);
    expect(provisionMock).toHaveBeenCalledWith("p1", expect.any(Object));
  });
});
