import { describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/v1/admin/system/integrations/github/route";
import { POST } from "@/app/api/v1/admin/system/integrations/github/healthcheck/route";

const { getConfigMock, updateConfigMock, healthMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn().mockResolvedValue({
    enabled: true,
    hasApiToken: true,
    tokenHint: "ghp_...abcd",
    username: "operator",
    email: "operator@example.com",
    lastCheckedAt: null,
    lastHealthStatus: null,
    lastHealthMessage: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  updateConfigMock: vi.fn().mockResolvedValue({
    enabled: true,
    hasApiToken: true,
    tokenHint: "ghp_...abcd",
    username: "operator",
    email: "operator@example.com",
    lastCheckedAt: null,
    lastHealthStatus: null,
    lastHealthMessage: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  healthMock: vi.fn().mockResolvedValue({
    ok: true,
    message: "GitHub connection healthy",
    statusCode: 200,
    checkedAt: "2026-03-02T10:00:00.000Z",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/github-adapter-service", () => ({
  getGitHubAdapterConfig: getConfigMock,
  updateGitHubAdapterConfig: updateConfigMock,
  runGitHubHealthcheck: healthMock,
}));

describe("/api/v1/admin/system/integrations/github", () => {
  it("GET returns config", async () => {
    const response = await GET(new Request("http://localhost/api/v1/admin/system/integrations/github"));
    expect(response.status).toBe(200);
    expect(getConfigMock).toHaveBeenCalledTimes(1);
  });

  it("PUT updates config", async () => {
    const request = new Request("http://localhost/api/v1/admin/system/integrations/github", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        username: "operator",
        email: "operator@example.com",
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(200);
    expect(updateConfigMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("POST healthcheck", async () => {
    const response = await POST(new Request("http://localhost/api/v1/admin/system/integrations/github/healthcheck", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(healthMock).toHaveBeenCalledTimes(1);
  });
});
