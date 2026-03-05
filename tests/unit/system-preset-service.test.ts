import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    systemPreset: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  AUTODEV_PRESET_KEY,
  getOrCreateAutodevSystemPreset,
  getSystemPresetByKey,
  upsertSystemPresetByKey,
} from "@/lib/services/system-preset-service";

describe("system-preset-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing autodev preset", async () => {
    prismaMock.systemPreset.findUnique.mockResolvedValue({ content: "# existing" });

    const result = await getOrCreateAutodevSystemPreset();

    expect(result).toBe("# existing");
    expect(prismaMock.systemPreset.findUnique).toHaveBeenCalledWith({
      where: { key: AUTODEV_PRESET_KEY },
      select: { content: true },
    });
  });

  it("creates fallback autodev preset when missing", async () => {
    prismaMock.systemPreset.findUnique.mockResolvedValue(null);
    prismaMock.systemPreset.upsert.mockResolvedValue({ content: "# fallback content" });

    const result = await getOrCreateAutodevSystemPreset();

    expect(result).toBe("# fallback content");
    expect(prismaMock.systemPreset.upsert).toHaveBeenCalled();
  });

  it("reads a preset by key", async () => {
    prismaMock.systemPreset.findUnique.mockResolvedValue({
      key: "autodev",
      content: "# preset",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const result = await getSystemPresetByKey("autodev");
    expect(result.key).toBe("autodev");
  });

  it("upserts a preset by key", async () => {
    prismaMock.systemPreset.upsert.mockResolvedValue({
      key: "autodev",
      content: "# updated",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const result = await upsertSystemPresetByKey("autodev", "# updated");
    expect(result.content).toBe("# updated");
  });
});
