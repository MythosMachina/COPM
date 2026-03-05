import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/admin/agent/runs/route";

const bootstrapMock = vi.fn().mockResolvedValue(undefined);
const tickMock = vi.fn().mockResolvedValue(undefined);
const triggerProjectMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/agent-run-service", () => ({
  listAgentRuns: vi.fn().mockResolvedValue([{ id: "r1", status: "RUNNING" }]),
}));

vi.mock("@/lib/orchestrator/worker", () => ({
  CopmAgentWorker: vi.fn().mockImplementation(() => ({
    bootstrap: bootstrapMock,
    tick: tickMock,
    triggerProject: triggerProjectMock,
  })),
}));

describe("/api/v1/admin/agent/runs route", () => {
  it("GET returns run list", async () => {
    const response = await GET(new Request("http://localhost/api/v1/admin/agent/runs"));
    expect(response.status).toBe(200);
  });

  it("POST triggers project", async () => {
    const request = new Request("http://localhost/api/v1/admin/agent/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "p1" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(202);
    expect(triggerProjectMock).toHaveBeenCalledWith("p1");
  });
});
