import { describe, expect, it, vi } from "vitest";
import { DELETE as DELETE_DOC, PATCH } from "@/app/api/v1/documentation/[id]/route";
import { DELETE as DELETE_PROJECT_DOCS, GET, POST } from "@/app/api/v1/projects/[id]/documentation/route";
import { AUTH_HEADER } from "@/tests/integration/auth-header";

vi.mock("@/lib/services/documentation-service", () => ({
  listDocumentationByProject: vi.fn().mockResolvedValue([]),
  deleteDocumentationByProject: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  deleteDocumentation: vi.fn().mockResolvedValue({ id: "d1" }),
  createDocumentation: vi.fn().mockResolvedValue({
    id: "d1",
    projectId: "p1",
    name: "Setup",
    content: "# Setup",
    version: 1,
    createdAt: "",
  }),
  updateDocumentation: vi.fn().mockResolvedValue({
    id: "d2",
    projectId: "p1",
    name: "Setup",
    content: "# Updated",
    version: 2,
    createdAt: "",
  }),
}));

describe("documentation routes", () => {
  it("GET project documentation", async () => {
    const response = await GET(new Request("http://localhost", { headers: AUTH_HEADER }), { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });

  it("POST project documentation", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Setup", content: "# Setup" }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });
    const response = await POST(req, { params: { id: "p1" } });
    expect(response.status).toBe(201);
  });

  it("PATCH documentation", async () => {
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ content: "# Updated" }),
      headers: { "content-type": "application/json", ...AUTH_HEADER },
    });
    const response = await PATCH(req, { params: { id: "d1" } });
    expect(response.status).toBe(200);
  });

  it("DELETE documentation by id", async () => {
    const req = new Request("http://localhost/api/v1/documentation/d1", {
      method: "DELETE",
      headers: AUTH_HEADER,
    });
    const response = await DELETE_DOC(req, { params: { id: "d1" } });
    expect(response.status).toBe(200);
  });

  it("DELETE project documentation", async () => {
    const req = new Request("http://localhost/api/v1/projects/p1/documentation?name=Setup", {
      method: "DELETE",
      headers: AUTH_HEADER,
    });
    const response = await DELETE_PROJECT_DOCS(req, { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });
});
