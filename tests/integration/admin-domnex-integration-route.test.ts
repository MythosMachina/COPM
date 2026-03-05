import { describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/v1/admin/system/integrations/domnex/route";
import { POST as POST_HEALTH } from "@/app/api/v1/admin/system/integrations/domnex/healthcheck/route";

const { getConfigMock, updateConfigMock, healthMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn().mockResolvedValue({
    enabled: false,
    baseUrl: "http://127.0.0.1:8443",
    defaultDomain: null,
    hasApiToken: false,
    tokenHint: null,
    lastCheckedAt: null,
    lastHealthStatus: null,
    lastHealthMessage: null,
    createdAt: "2026-03-02T10:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
  }),
  updateConfigMock: vi.fn().mockResolvedValue({
    enabled: true,
    baseUrl: "https://domnex.example.internal",
    defaultDomain: "example.com",
    hasApiToken: true,
    tokenHint: "dnx_...abcd",
    lastCheckedAt: null,
    lastHealthStatus: null,
    lastHealthMessage: null,
    createdAt: "2026-03-02T10:00:00.000Z",
    updatedAt: "2026-03-02T10:01:00.000Z",
  }),
  healthMock: vi.fn().mockResolvedValue({
    ok: true,
    message: "DomNex connection healthy",
    statusCode: 200,
    checkedAt: "2026-03-02T10:02:00.000Z",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/domnex-adapter-service", () => ({
  getDomNexAdapterConfig: getConfigMock,
  updateDomNexAdapterConfig: updateConfigMock,
  runDomNexHealthcheck: healthMock,
}));

describe("domnex integration admin routes", () => {
  it("GET returns adapter config", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("PUT updates adapter config", async () => {
    const request = new Request("http://localhost/api/v1/admin/system/integrations/domnex", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        baseUrl: "https://domnex.example.internal",
        defaultDomain: "example.com",
        apiToken: "dnx_abcdefghijklmnopqrstuvwxyz",
      }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    expect(updateConfigMock).toHaveBeenCalled();
  });

  it("POST healthcheck returns result", async () => {
    const response = await POST_HEALTH();
    expect(response.status).toBe(200);
    expect(healthMock).toHaveBeenCalled();
  });
});
