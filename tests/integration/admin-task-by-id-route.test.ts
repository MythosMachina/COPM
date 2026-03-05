import { describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/v1/admin/tasks/[id]/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/task-service", () => ({
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

describe("/api/v1/admin/tasks/:id route", () => {
  it("PATCH rejects legacy task updates", async () => {
    const req = new Request("http://localhost/api/v1/admin/tasks/t1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "DONE", title: "Task updated" }),
    });

    const response = await PATCH(req, { params: { id: "t1" } });
    expect(response.status).toBe(400);
  });

  it("DELETE rejects legacy task deletes", async () => {
    const req = new Request("http://localhost/api/v1/admin/tasks/t1", {
      method: "DELETE",
    });

    const response = await DELETE(req, { params: { id: "t1" } });
    expect(response.status).toBe(400);
  });
});
