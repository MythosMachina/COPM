import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/projects/[id]/tasks/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/task-service", () => ({
  createTask: vi.fn(),
}));

describe("/api/v1/admin/projects/:id/tasks route", () => {
  it("POST rejects legacy task creation", async () => {
    const req = new Request("http://localhost/api/v1/admin/projects/p1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Task",
        istState: "As-is",
        sollState: "To-be",
        technicalPlan: "Plan",
        riskImpact: "Low",
      }),
    });

    const response = await POST(req, { params: { id: "p1" } });
    expect(response.status).toBe(400);
  });
});
