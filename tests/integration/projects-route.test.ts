import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/projects/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

vi.mock("@/lib/services/project-service", () => ({
  listProjects: vi.fn().mockResolvedValue([
    { id: "p1", name: "A", target: "B", autonomousAgentEnabled: false, createdAt: "", updatedAt: "" },
  ]),
  createProject: vi
    .fn()
    .mockResolvedValue({ id: "p2", name: "N", target: "T", autonomousAgentEnabled: false, createdAt: "", updatedAt: "" }),
}));

describe("/api/v1/projects route", () => {
  it("GET returns project list", async () => {
    const response = await GET(new Request("http://localhost/api/v1/projects", { headers: AUTH_HEADER }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean };
    expect(payload.success).toBe(true);
  });

  it("POST validates and creates project", async () => {
    const req = new Request("http://localhost/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Name", target: "Target text long enough" }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
  });
});
