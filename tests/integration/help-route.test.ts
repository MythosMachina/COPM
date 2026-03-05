import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/help/route";

describe("/api/help route", () => {
  it("returns endpoint metadata", async () => {
    const response = await GET(new Request("http://localhost:3300/api/help"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: { endpoints: Array<{ path: string }> };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.endpoints.length).toBeGreaterThan(0);
    expect(payload.data.endpoints.some((entry) => entry.path.endsWith("/api/v1/admin/system/presets/autodev"))).toBe(true);
  });
});
