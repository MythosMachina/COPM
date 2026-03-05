import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/admin/projects/[id]/export/pdf/route";

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/project-export-service", () => ({
  getProjectExportBundle: vi.fn().mockResolvedValue({
    project: { name: "Demo Project" },
  }),
  buildProjectPdfDocument: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4")),
}));

describe("/api/v1/admin/projects/:id/export/pdf route", () => {
  it("returns pdf attachment", async () => {
    const response = await GET(new Request("http://localhost"), { params: { id: "p1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")?.includes(".pdf")).toBe(true);
  });
});
