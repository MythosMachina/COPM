import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createApiKey, listApiKeys } from "@/lib/services/apikey-service";

describe("apikey-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an API key", async () => {
    prismaMock.apiKey.create.mockResolvedValue({
      id: "k1",
      name: "Main",
      keyPrefix: "ck_1234567890",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const result = await createApiKey({ name: "Main", createdByUserId: "u1" });
    expect(result.token.startsWith("ck_")).toBe(true);
  });

  it("lists API keys", async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([
      {
        id: "k1",
        name: "Main",
        keyPrefix: "ck_1234567890",
        createdByUserId: "u1",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        lastUsedAt: null,
        revokedAt: null,
      },
    ]);

    const result = await listApiKeys();
    expect(result).toHaveLength(1);
  });
});
