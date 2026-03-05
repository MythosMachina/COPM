import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/projects/[id]/lifecycle/runs/[runId]/resume/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

const { resumeMock } = vi.hoisted(() => ({
  resumeMock: vi.fn().mockResolvedValue({
    run: { id: "run1", status: "RUNNING" },
    modules: [],
    transitions: [],
    evidences: [],
  }),
}));

vi.mock("@/lib/services/lifecycle-service", () => ({
  resumeLifecycleRun: resumeMock,
}));

describe("/api/v1/projects/:id/lifecycle/runs/:runId/resume route", () => {
  it("POST resumes lifecycle run", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/lifecycle/runs/r1/resume", {
      method: "POST",
      headers: { "content-type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify({ reason: "Continue" }),
    });
    const response = await POST(request, { params: { id: "p1", runId: "r1" } });
    expect(response.status).toBe(200);
  });
});
