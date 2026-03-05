import { describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/v1/tasks/[id]/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

vi.mock("@/lib/services/task-service", () => ({
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
}));

describe("/api/v1/tasks/:id route", () => {
  it("PATCH rejects legacy task updates", async () => {
    const req = new Request("http://localhost/api/v1/tasks/t1", {
      method: "PATCH",
      body: JSON.stringify({ status: "DONE" }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });

    const response = await PATCH(req, { params: { id: "t1" } });
    expect(response.status).toBe(400);
  });

  it("DELETE rejects legacy task deletes", async () => {
    const req = new Request("http://localhost/api/v1/tasks/t1", {
      method: "DELETE",
      headers: AUTH_HEADER,
    });

    const response = await DELETE(req, { params: { id: "t1" } });
    expect(response.status).toBe(400);
  });
});
