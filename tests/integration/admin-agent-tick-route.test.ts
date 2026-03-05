import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/admin/agent/tick/route";

const bootstrapMock = vi.fn().mockResolvedValue(undefined);
const tickMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth/session-auth", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/orchestrator/worker", () => ({
  CopmAgentWorker: vi.fn().mockImplementation(() => ({
    bootstrap: bootstrapMock,
    tick: tickMock,
  })),
}));

describe("/api/v1/admin/agent/tick route", () => {
  it("POST triggers one orchestrator tick", async () => {
    const response = await POST();
    expect(response.status).toBe(202);
    expect(tickMock).toHaveBeenCalledWith("MANUAL");
  });
});
