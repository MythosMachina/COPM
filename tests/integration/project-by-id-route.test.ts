import { describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/v1/projects/[id]/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

vi.mock("@/lib/services/project-service", () => ({
  getProjectById: vi
    .fn()
    .mockResolvedValue({ id: "p1", name: "A", target: "B", autonomousAgentEnabled: false, createdAt: "", updatedAt: "" }),
  updateProject: vi
    .fn()
    .mockResolvedValue({ id: "p1", name: "C", target: "D", autonomousAgentEnabled: true, createdAt: "", updatedAt: "" }),
  deleteProject: vi.fn().mockResolvedValue({ id: "p1" }),
}));

describe("/api/v1/projects/:id route", () => {
  it("GET returns project", async () => {
    const response = await GET(new Request("http://localhost", { headers: AUTH_HEADER }), { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });

  it("PATCH updates project", async () => {
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });
    const response = await PATCH(req, { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });

  it("DELETE removes project", async () => {
    const response = await DELETE(new Request("http://localhost", { headers: AUTH_HEADER }), { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });
});
