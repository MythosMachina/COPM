import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { ValidationError } from "@/lib/api/errors";
import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { getOrchestratorConfig } from "@/lib/orchestrator/config";
import { hasBlockingRun } from "@/lib/services/agent-run-service";
import { createDocumentation } from "@/lib/services/documentation-service";
import { getLifecycleRunDetail, upsertLifecycleModulePrephaseReview } from "@/lib/services/lifecycle-service";
import { getProjectById, updateProject } from "@/lib/services/project-service";

function sanitize(value: string): string {
  return value
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .trim();
}

async function runCodexCheck(prompt: string, cwd: string): Promise<string> {
  const config = getOrchestratorConfig();
  const args =
    config.codexArgs.length > 0
      ? config.codexArgs
      : ["exec", "-", "--skip-git-repo-check", "--sandbox", "danger-full-access"];

  return await new Promise<string>((resolve, reject) => {
    const child = spawn(config.codexCommand, args, {
      cwd,
      env: {
        ...process.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, 120_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const text = sanitize([...stdout, ...stderr].join("\n"));
      if (code !== 0) {
        reject(new ValidationError(`AI check failed (exit ${code ?? "unknown"})`, { output: text.slice(0, 2000) }));
        return;
      }
      resolve(text);
    });

    child.stdin.write(`${prompt}\n`);
    child.stdin.end();
  });
}

export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: { id: string; runId: string; moduleId: string } }) => {
    await requireAdminSession();
    // AI Check is a one-shot review action; keep autonomous worker disabled.
    await updateProject(params.id, { autonomousAgentEnabled: false });

    if (await hasBlockingRun(params.id)) {
      throw new ValidationError("AI Check blocked: an agent run is currently active. Wait for completion or stop it.");
    }

    const [project, detail] = await Promise.all([
      getProjectById(params.id),
      getLifecycleRunDetail(params.id, params.runId),
    ]);
    const moduleEntry = detail.modules.find((entry) => entry.id === params.moduleId);
    if (!moduleEntry) {
      throw new ValidationError("Lifecycle module not found");
    }

    const workspacePath = path.resolve(process.cwd(), "workspaces", project.visualId);
    await fs.mkdir(workspacePath, { recursive: true });

    const prompt = [
      "You are a technical reviewer for one lifecycle module.",
      "Goal: confirm understanding and propose concrete improvements before implementation.",
      "Return only this exact structure:",
      "Title rewrite:",
      "Description rewrite:",
      "Additions:",
      "1. ...",
      "2. ...",
      "Risks:",
      "1. ...",
      "2. ...",
      "Ready for build:",
      "Missing before build:",
      "1. ...",
      "",
      `Project: ${project.name} (${project.visualId})`,
      `Project target: ${project.target}`,
      `Lifecycle run: ${detail.run.title} (${detail.run.id})`,
      `Module #${moduleEntry.moduleOrder}: ${moduleEntry.title}`,
      `Module type: ${moduleEntry.moduleType}`,
      `Module status: ${moduleEntry.status}`,
      `Module description: ${moduleEntry.description}`,
      `Expected state: ${moduleEntry.expectedState}`,
      `Risk level: ${moduleEntry.riskLevel}`,
    ].join("\n");

    const output = await runCodexCheck(prompt, workspacePath);
    const content = output || "No AI output captured.";

    await upsertLifecycleModulePrephaseReview(params.id, params.runId, params.moduleId, { content });

    const doc = await createDocumentation(params.id, {
      name: `MODULE:AI_CHECK:${params.runId}:${params.moduleId}`,
      content: [
        "---",
        "kind: MODULE_AI_CHECK",
        `projectId: ${params.id}`,
        `runId: ${params.runId}`,
        `moduleId: ${params.moduleId}`,
        `moduleOrder: ${moduleEntry.moduleOrder}`,
        `source: COPM_AGENT`,
        "---",
        "",
        `# AI Check: Module #${moduleEntry.moduleOrder} - ${moduleEntry.title}`,
        "",
        content,
      ].join("\n"),
    });

    return jsonSuccess({ moduleId: params.moduleId, documentationId: doc.id });
  },
);
