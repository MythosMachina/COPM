import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/projects/[id]/ai-kickstart/route";

vi.mock("@/lib/auth/codex-auth", () => ({
  assertCodexApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/project-admin-service", () => ({
  buildAiKickstartPayload: vi.fn().mockResolvedValue({
    version: "ai-kickstart-v1",
    projectId: "p1",
    installInstructions: ["step 1"],
    autodevExcerpt: "excerpt",
    projectPlanAgentsMd: "# AGENTS.md",
  }),
}));

describe("/api/v1/projects/:id/ai-kickstart route", () => {
  it("returns ai kickstart payload", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/ai-kickstart", {
      headers: { authorization: "Bearer test" },
    });

    const response = await GET(request, { params: { id: "p1" } });
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      data: { version?: string };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.version).toBe("ai-kickstart-v1");
  });
});
