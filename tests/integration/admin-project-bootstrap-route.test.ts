import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/projects/bootstrap/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/project-admin-service", () => ({
  createProjectBootstrap: vi.fn().mockResolvedValue({
    project: { id: "p1", name: "Demo", target: "T", createdAt: "", updatedAt: "" },
    lifecycleRun: { id: "r1", title: "Run", mode: "STEP", status: "DRAFT", moduleCount: 1 },
    documentation: [{ id: "d1", name: "Doc", version: 1 }],
  }),
}));

describe("/api/v1/admin/projects/bootstrap route", () => {
  it("creates complete project package", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Demo",
        target: "Demo project objective with enough text",
        lifecycle: {
          title: "Initial Lifecycle Run",
          mode: "STEP",
          classification: "BIRTH",
          autoStart: true,
          modules: [
            {
              moduleOrder: 1,
              moduleType: "TECHSTACK",
              title: "Task",
              description: "Current baseline",
              expectedState: "Target baseline",
            },
          ],
        },
        documentation: [
          {
            name: "Runbook",
            content: "# Runbook",
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
