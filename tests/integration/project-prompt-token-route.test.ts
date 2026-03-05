import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/projects/[id]/prompt-token/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireOperatorSession: vi.fn().mockResolvedValue({ user: { id: "u1" } }),
}));

vi.mock("@/lib/services/user-service", () => ({
  verifyUserPassword: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/project-service", () => ({
  getProjectById: vi.fn().mockResolvedValue({ id: "p1", visualId: "PRJ-0001" }),
}));

vi.mock("@/lib/services/apikey-service", () => ({
  createApiKey: vi.fn().mockResolvedValue({
    id: "k1",
    keyPrefix: "ck_1234567890",
    token: "ck_secret",
  }),
}));

describe("/api/v1/projects/:id/prompt-token route", () => {
  it("creates a project-scoped prompt token", async () => {
    const request = new Request("http://localhost/api/v1/projects/p1/prompt-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      success: boolean;
      data: { token?: string; projectId?: string };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.token).toBe("ck_secret");
    expect(payload.data.projectId).toBe("p1");
  });
});
