import { describe, expect, it } from "vitest";
import { buildLifecycleSystemPrompt } from "@/lib/orchestrator/prompt-templates";

describe("prompt-templates", () => {
  it("builds layered lifecycle prompt with mode and module context", () => {
    const prompt = buildLifecycleSystemPrompt({
      run: {
        id: "run1",
        projectId: "p1",
        title: "Initial Lifecycle Run",
        mode: "STEP",
        status: "BLOCKED",
        classification: "BIRTH",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
        startedAt: "2026-03-02T00:00:00.000Z",
        finishedAt: null,
      },
      modules: [
        {
          id: "m1",
          runId: "run1",
          moduleOrder: 1,
          moduleType: "TECHSTACK",
          title: "Techstack Foundation",
          description: "Setup node runtime",
          config: { runtime: "node", framework: "nextjs" },
          expectedState: "Runtime scaffold complete",
          actualState: null,
          gateRequired: false,
          completionPolicy: "PAUSE_ALWAYS",
          riskLevel: "MEDIUM",
          status: "COMPLETED",
          lastError: null,
          createdAt: "2026-03-02T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
          startedAt: "2026-03-02T00:00:00.000Z",
          completedAt: "2026-03-02T00:01:00.000Z",
        },
        {
          id: "m2",
          runId: "run1",
          moduleOrder: 2,
          moduleType: "CHECK",
          title: "Quality Gate",
          description: "Run lint and build",
          config: {},
          expectedState: "Quality checks passed",
          actualState: null,
          gateRequired: true,
          completionPolicy: "PAUSE_ALWAYS",
          riskLevel: "HIGH",
          status: "BLOCKED",
          lastError: null,
          createdAt: "2026-03-02T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
        },
      ],
      transitions: [],
      evidences: [],
    });

    expect(prompt).toContain("Lifecycle Prompt Template");
    expect(prompt).toContain("Lifecycle Mode: STEP");
    expect(prompt).toContain("Techstack module: #1 Techstack Foundation");
    expect(prompt).toContain("Current module: #2 Quality Gate");
    expect(prompt).toContain("Run status: BLOCKED");
  });
});
