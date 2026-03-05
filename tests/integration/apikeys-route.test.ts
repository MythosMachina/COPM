import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/apikeys/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/apikey-service", () => ({
  listApiKeys: vi.fn().mockResolvedValue([]),
  createApiKey: vi.fn().mockResolvedValue({
    id: "k1",
    name: "test",
    keyPrefix: "ck_1234567890",
    createdAt: "2026-03-01T00:00:00.000Z",
    token: "ck_secret",
  }),
}));

describe("/api/v1/apikeys route", () => {
  it("GET lists keys", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("POST creates key", async () => {
    const req = new Request("http://localhost/api/v1/apikeys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
  });
});
