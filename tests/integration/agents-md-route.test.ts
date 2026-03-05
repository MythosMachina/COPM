import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/projects/[id]/agents-md/route";

vi.mock("@/lib/auth/codex-auth", () => ({
  assertCodexApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/project-admin-service", () => ({
  buildAgentsMarkdownForProject: vi.fn().mockResolvedValue(`# AGENTS.md\n\n- Name: Demo\n`),
}));

describe("/api/v1/projects/:id/agents-md route", () => {
  it("returns markdown download", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/agents-md", {
      headers: { authorization: "Bearer test" },
    });

    const response = await GET(request, { params: { id: "p1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")?.includes("text/markdown")).toBe(true);
    expect(response.headers.get("content-disposition")?.includes("AGENTS.md")).toBe(true);
  });
});
