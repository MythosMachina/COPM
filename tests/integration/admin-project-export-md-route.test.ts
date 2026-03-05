import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/admin/projects/[id]/export/md/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/project-admin-service", () => ({
  buildAgentsMarkdownForProject: vi.fn().mockResolvedValue("# AGENTS.md\n\n- Name: Demo\n"),
}));

describe("/api/v1/admin/projects/:id/export/md route", () => {
  it("returns markdown attachment", async () => {
    const response = await GET(new Request("http://localhost"), { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")?.includes("text/markdown")).toBe(true);
    expect(response.headers.get("content-disposition")?.includes(".md")).toBe(true);
  });
});
