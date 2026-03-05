import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { isInitialSetupRequired, registerInitialUser } from "@/lib/services/user-service";

describe("user-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports initial setup required", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    await expect(isInitialSetupRequired()).resolves.toBe(true);
  });

  it("creates first admin", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.create.mockResolvedValue({
      id: "u1",
      username: "admin",
      email: "admin@example.com",
      role: "ADMIN",
      createdAt: new Date(),
    });

    const created = await registerInitialUser({
      username: "admin",
      email: "admin@example.com",
      password: "StrongPassword123!",
    });

    expect(created.role).toBe("ADMIN");
  });
});
