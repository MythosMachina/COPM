import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/projects/[id]/lifecycle/runs/[runId]/start/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

const { startMock } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue({
    run: { id: "run1", status: "RUNNING" },
    modules: [],
    transitions: [],
    evidences: [],
  }),
}));

vi.mock("@/lib/services/lifecycle-service", () => ({
  startLifecycleBuild: startMock,
}));

describe("/api/v1/projects/:id/lifecycle/runs/:runId/start route", () => {
  it("POST starts lifecycle build from draft", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/lifecycle/runs/r1/start", {
      method: "POST",
      headers: AUTH_HEADER,
    });
    const response = await POST(request, { params: { id: "p1", runId: "r1" } });
    expect(response.status).toBe(200);
  });
});
