import path from "node:path";
import { ValidationError } from "@/lib/api/errors";

function asInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export type OrchestratorConfig = {
  baseUrl: string;
  apiToken: string;
  workspaceRoot: string;
  pollIntervalMs: number;
  staleRunMinutes: number;
  maxRunMs: number;
  codexCommand: string;
  codexArgs: string[];
  projectFilter: string | null;
};

export function getOrchestratorConfig(): OrchestratorConfig {
  const baseUrl = process.env.COPM_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3300";
  const apiToken = process.env.COPM_AGENT_API_TOKEN?.trim() || process.env.COPM_API_TOKEN?.trim() || "";

  if (!apiToken) {
    throw new ValidationError("Missing COPM agent token. Set COPM_AGENT_API_TOKEN.");
  }

  const workspaceRoot = process.env.COPM_AGENT_WORKSPACE_ROOT?.trim() || path.resolve(process.cwd(), "workspaces");
  const pollIntervalMs = asInt(process.env.COPM_AGENT_POLL_MS, 10_000);
  const staleRunMinutes = asInt(process.env.COPM_AGENT_STALE_RUN_MIN, 2);
  const maxRunMs = asInt(process.env.COPM_AGENT_MAX_RUN_MS, 300_000);
  const codexCommand = process.env.COPM_AGENT_CODEX_COMMAND?.trim() || "codex";
  const codexArgsRaw = process.env.COPM_AGENT_CODEX_ARGS?.trim() || "";
  const codexArgs = codexArgsRaw.length > 0 ? codexArgsRaw.split(" ").filter(Boolean) : [];
  const projectFilter = process.env.COPM_AGENT_PROJECT_FILTER?.trim() || null;

  return {
    baseUrl,
    apiToken,
    workspaceRoot,
    pollIntervalMs,
    staleRunMinutes,
    maxRunMs,
    codexCommand,
    codexArgs,
    projectFilter,
  };
}
