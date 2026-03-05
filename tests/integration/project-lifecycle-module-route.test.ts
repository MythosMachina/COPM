import { describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/v1/projects/[id]/lifecycle/runs/[runId]/modules/[moduleId]/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn().mockResolvedValue({
    run: { id: "run1", status: "BLOCKED" },
    modules: [],
    transitions: [],
    evidences: [],
  }),
}));

vi.mock("@/lib/services/lifecycle-service", () => ({
  updateLifecycleModuleStatus: updateMock,
}));

describe("/api/v1/projects/:id/lifecycle/runs/:runId/modules/:moduleId route", () => {
  it("PATCH updates module status", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/lifecycle/runs/r1/modules/m1", {
      method: "PATCH",
      headers: { "content-type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify({
        status: "COMPLETED",
        evidence: { kind: "CHECK", summary: "ok" },
      }),
    });
    const response = await PATCH(request, { params: { id: "p1", runId: "r1", moduleId: "m1" } });
    expect(response.status).toBe(200);
  });
});
