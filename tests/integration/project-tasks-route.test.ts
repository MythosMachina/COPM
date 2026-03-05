import { describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/v1/projects/[id]/tasks/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

vi.mock("@/lib/services/task-service", () => ({
  listTasksByProject: vi.fn().mockResolvedValue([]),
  deleteTasksByProject: vi.fn(),
  createTask: vi.fn(),
}));

describe("/api/v1/projects/:id/tasks route", () => {
  it("GET returns task list", async () => {
    const response = await GET(new Request("http://localhost", { headers: AUTH_HEADER }), { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });

  it("POST rejects legacy task creation", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "Task",
        istState: "As-is",
        sollState: "To-be",
        technicalPlan: "Plan",
        riskImpact: "Low",
      }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });
    const response = await POST(req, { params: { id: "p1" } });
    expect(response.status).toBe(400);
  });

  it("DELETE rejects legacy task deletion", async () => {
    const req = new Request("http://localhost/api/v1/projects/p1/tasks?status=DONE", {
      method: "DELETE",
      headers: AUTH_HEADER,
    });
    const response = await DELETE(req, { params: { id: "p1" } });
    expect(response.status).toBe(400);
  });
});
