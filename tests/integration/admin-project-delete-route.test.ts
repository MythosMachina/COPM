import { describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/v1/admin/projects/[id]/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/project-service", () => ({
  deleteProject: vi.fn().mockResolvedValue({ id: "p1" }),
}));

describe("/api/v1/admin/projects/:id route", () => {
  it("DELETE removes project for admin", async () => {
    const response = await DELETE(new Request("http://localhost"), { params: { id: "p1" } });
    expect(response.status).toBe(200);
  });
});
