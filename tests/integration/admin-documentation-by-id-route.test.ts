import { describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/v1/admin/documentation/[id]/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/documentation-service", () => ({
  deleteDocumentation: vi.fn().mockResolvedValue({ id: "d1" }),
}));

describe("/api/v1/admin/documentation/:id route", () => {
  it("DELETE removes one documentation entry", async () => {
    const response = await DELETE(new Request("http://localhost"), { params: { id: "d1" } });
    expect(response.status).toBe(200);
  });
});
