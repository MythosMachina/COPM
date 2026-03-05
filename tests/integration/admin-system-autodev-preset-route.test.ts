import { describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/v1/admin/system/presets/autodev/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/system-preset-service", () => ({
  AUTODEV_PRESET_KEY: "autodev",
  getSystemPresetByKey: vi.fn().mockResolvedValue({
    key: "autodev",
    content: "# preset",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  upsertSystemPresetByKey: vi.fn().mockResolvedValue({
    key: "autodev",
    content: "# updated preset content for copm",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
}));

describe("/api/v1/admin/system/presets/autodev route", () => {
  it("GET returns preset", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; data: { key: string } };
    expect(payload.success).toBe(true);
    expect(payload.data.key).toBe("autodev");
  });

  it("PUT updates preset", async () => {
    const request = new Request("http://localhost/api/v1/admin/system/presets/autodev", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# updated preset content for copm" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; data: { key: string } };
    expect(payload.success).toBe(true);
    expect(payload.data.key).toBe("autodev");
  });
});
