import { describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/v1/admin/projects/[id]/agent-opt-in/route";

const { bootstrapMock, triggerProjectMock, resetAgentProjectMock } = vi.hoisted(() => ({
  bootstrapMock: vi.fn().mockResolvedValue(undefined),
  triggerProjectMock: vi.fn().mockResolvedValue(undefined),
  resetAgentProjectMock: vi.fn().mockResolvedValue({
    canceledRuns: 1,
    killedPids: 1,
    resolvedQuestions: 0,
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/orchestrator/worker", () => ({
  CopmAgentWorker: vi.fn().mockImplementation(() => ({
    bootstrap: bootstrapMock,
    triggerProject: triggerProjectMock,
  })),
}));

vi.mock("@/lib/services/agent-run-service", () => ({
  resetAgentProject: resetAgentProjectMock,
}));

vi.mock("@/lib/services/project-service", () => ({
  updateProject: vi.fn().mockImplementation(async (_id: string, input: { autonomousAgentEnabled?: boolean }) => ({
    id: "p1",
    visualId: "PRJ-0001",
    name: "Demo",
    target: "Demo target text",
    autonomousAgentEnabled: Boolean(input.autonomousAgentEnabled),
    createdAt: "",
    updatedAt: "",
  })),
}));

describe("/api/v1/admin/projects/:id/agent-opt-in route", () => {
  it("PATCH enable triggers worker", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/agent-opt-in", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autonomousAgentEnabled: true }),
    });

    const response = await PATCH(request, { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(triggerProjectMock).toHaveBeenCalledWith("p1");
  });

  it("PATCH disable resets running state", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/agent-opt-in", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autonomousAgentEnabled: false }),
    });

    const response = await PATCH(request, { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(resetAgentProjectMock).toHaveBeenCalledWith("p1");
  });
});
