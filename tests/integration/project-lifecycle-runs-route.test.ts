import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/projects/[id]/lifecycle/runs/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

const { listMock, createMock } = vi.hoisted(() => ({
  listMock: vi.fn().mockResolvedValue([]),
  createMock: vi.fn().mockResolvedValue({
    run: { id: "run1", status: "RUNNING" },
    modules: [],
    transitions: [],
    evidences: [],
  }),
}));

vi.mock("@/lib/services/lifecycle-service", () => ({
  listLifecycleRunsByProject: listMock,
  createLifecycleRun: createMock,
}));

describe("/api/v1/projects/:id/lifecycle/runs route", () => {
  it("GET lists lifecycle runs", async () => {
    const response = await GET(new Request("http://localhost/api/v1/projects/p1/lifecycle/runs", { headers: AUTH_HEADER }), {
      params: { id: "p1" },
    });
    expect(response.status).toBe(200);
  });

  it("POST creates lifecycle run", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/lifecycle/runs", {
      method: "POST",
      headers: { "content-type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify({
        title: "Birth",
        mode: "STEP",
        modules: [
          {
            moduleOrder: 1,
            moduleType: "TECHSTACK",
            title: "Init",
            description: "Scaffold",
            expectedState: "Ready",
          },
        ],
      }),
    });
    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(201);
  });
});
