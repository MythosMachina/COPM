import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/register/route";

vi.mock("@/lib/services/user-service", () => ({
  registerInitialUser: vi.fn().mockResolvedValue({
    id: "u1",
    username: "admin",
    email: "admin@example.com",
    role: "ADMIN",
    createdAt: "",
  }),
}));

describe("/api/register route", () => {
  it("creates initial admin account", async () => {
    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        email: "admin@example.com",
        password: "StrongPassword123!",
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
  });
});
