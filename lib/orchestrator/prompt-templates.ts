import type { LifecycleModuleRef, LifecycleRunDetailRef } from "@/lib/orchestrator/types";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function formatList(lines: string[]): string[] {
  return lines.filter(Boolean).map((line) => `- ${line}`);
}

function pickCurrentModule(modules: LifecycleModuleRef[]): LifecycleModuleRef | null {
  const byPriority = ["RUNNING", "BLOCKED", "PENDING"] as const;
  for (const status of byPriority) {
    const moduleEntry = modules.find((entry) => entry.status === status);
    if (moduleEntry) {
      return moduleEntry;
    }
  }
  return modules.length > 0 ? modules[0] ?? null : null;
}

function buildModeSection(mode: "STEP" | "BATCH"): string[] {
  if (mode === "STEP") {
    return [
      "Lifecycle Mode: STEP",
      "Execution policy: stop after each module completion and wait for operator resume.",
      "Do not continue to next module unless run status is resumed by operator.",
    ];
  }
  return [
    "Lifecycle Mode: BATCH",
    "Execution policy: continue automatically through modules.",
    "Pause only when operator explicitly blocks/resumes the run.",
  ];
}

function buildTechstackSection(modules: LifecycleModuleRef[]): string[] {
  const techstack = modules.find((module) => module.moduleType === "TECHSTACK");
  if (!techstack) {
    return ["No TECHSTACK module defined for this run."];
  }

  const config = asObject(techstack.config);
  const runtime = String(config.runtime ?? "").trim();
  const framework = String(config.framework ?? "").trim();
  const packageManager = String(config.packageManager ?? "").trim();

  return [
    `Techstack module: #${techstack.moduleOrder} ${techstack.title}`,
    runtime ? `Runtime: ${runtime}` : "",
    framework ? `Framework: ${framework}` : "",
    packageManager ? `Package manager: ${packageManager}` : "",
  ].filter(Boolean);
}

function buildFeatureSection(modules: LifecycleModuleRef[]): string[] {
  const features = modules
    .filter((module) => module.moduleType === "FEATURE")
    .sort((a, b) => a.moduleOrder - b.moduleOrder);
  if (features.length === 0) {
    return ["No FEATURE modules defined for this run."];
  }

  return features.map(
    (module) => `#${module.moduleOrder} ${module.title} | status=${module.status}`,
  );
}

function buildCurrentModuleSection(module: LifecycleModuleRef | null): string[] {
  if (!module) {
    return ["No active module selected."];
  }
  return [
    `Current module: #${module.moduleOrder} ${module.title}`,
    `Type: ${module.moduleType}`,
    `Status: ${module.status}`,
    `Description: ${module.description}`,
    `Gate required: ${module.gateRequired}`,
    `Risk level: ${module.riskLevel}`,
  ];
}

function buildAllModulesSection(run: LifecycleRunDetailRef): string[] {
  return [...run.modules]
    .sort((a, b) => a.moduleOrder - b.moduleOrder)
    .map(
      (module) =>
        `#${module.moduleOrder} ${module.title} | type=${module.moduleType} | status=${module.status} | risk=${module.riskLevel}`,
    );
}

function buildStateSection(run: LifecycleRunDetailRef): string[] {
  const completed = run.modules.filter((module) => module.status === "COMPLETED").length;
  const failed = run.modules.filter((module) => module.status === "FAILED").length;
  const blocked = run.modules.filter((module) => module.status === "BLOCKED").length;
  const total = run.modules.length;
  return [
    `Run status: ${run.run.status}`,
    `Classification: ${run.run.classification}`,
    `Progress: ${completed}/${total} completed`,
    `Blocked modules: ${blocked}`,
    `Failed modules: ${failed}`,
    `Evidence entries: ${run.evidences.length}`,
  ];
}

export function buildLifecycleSystemPrompt(run: LifecycleRunDetailRef): string {
  const currentModule = pickCurrentModule(run.modules);
  return [
    "Lifecycle Prompt Template",
    "=========================",
    "",
    "Core:",
    ...formatList([
      "Single source of truth is COPM lifecycle run state.",
      "Do not treat legacy tasks as execution source; they are archive only.",
      "Every critical step requires structured evidence and module status update.",
      "Respect project isolation: execute inside project workspace boundaries, except required host-level runtime provisioning (project-scoped only).",
      "Use dedicated project database only (name equals project visual ID), never COPM ops database.",
    ]),
    "",
    "Mode Layer:",
    ...formatList(buildModeSection(run.run.mode)),
    "",
    "Techstack Layer:",
    ...formatList(buildTechstackSection(run.modules)),
    "",
    "Feature Layer:",
    ...formatList(buildFeatureSection(run.modules)),
    "",
    "Current Module Layer:",
    ...formatList(buildCurrentModuleSection(currentModule)),
    "",
    "Runtime State Layer:",
    ...formatList(buildStateSection(run)),
  ].join("\n");
}

export function buildLifecyclePrephasePrompt(run: LifecycleRunDetailRef): string {
  return [
    "Lifecycle Prephase Template",
    "===========================",
    "",
    "Objective:",
    ...formatList([
      "Review the full lifecycle module plan before build starts.",
      "Suggest improvements, rewrites, missing details and risk reductions for every module.",
      "Do not execute implementation actions in this phase.",
    ]),
    "",
    "Hard rules:",
    ...formatList([
      "No code implementation, no deployment, no provisioning in prephase.",
      "No lifecycle module status changes in prephase.",
      "Output must be actionable and operator-readable.",
    ]),
    "",
    "Run Context:",
    ...formatList(buildStateSection(run)),
    "",
    "Modules In Scope:",
    ...formatList(buildAllModulesSection(run)),
    "",
    "Required Output Format:",
    ...formatList([
      "Summary: 3-5 lines across whole run (operator-focused, no fluff).",
      "Then emit one block per module in strict format:",
      "[[MODULE_REVIEW:<moduleOrder>]]",
      "Title rewrite: short replacement title",
      "Description rewrite: concise replacement description (2-4 lines)",
      "Additions: exactly 3 concrete improvements as numbered list",
      "Risks: exactly 2 concrete risks as numbered list",
      "Ready for build: YES|NO",
      "Missing before build: numbered list (empty only if YES)",
      "[[/MODULE_REVIEW]]",
      "Emit a block for every moduleOrder in this run. Do not skip modules.",
    ]),
  ].join("\n");
}
