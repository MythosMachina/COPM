import type { AgentRunStatus } from "@prisma/client";

export type CopmApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export type ProjectRef = {
  id: string;
  visualId: string;
  name: string;
  target: string;
  autonomousAgentEnabled: boolean;
  autoProvisionDomain: boolean;
  provisionStatus: "DISABLED" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  provisionError: string | null;
  fqdn: string | null;
  domnexHostId: string | null;
  provisionUpstreamUrl: string | null;
  provisionInsecureTls: boolean;
  provisionHaEnabled: boolean;
  provisionedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDocumentation = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  version: number;
  createdAt: string;
};

export type ProjectTask = {
  id: string;
  visualId: string;
  projectId: string;
  title: string;
  executionOrder: number;
  status: "ACTIVE" | "DONE";
  requiresOperatorFeedback: boolean;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
  createdAt: string;
  updatedAt: string;
};

export type AiKickstartPayload = {
  version: string;
  startupPrompts?: {
    systemPrompt?: string;
    userPrompt?: string;
    oneShotPrompt?: string;
  };
  projectPlanAgentsMd?: string;
  autodevSkillFull?: string;
  apiHelp?: unknown;
};

export type LifecycleRunRef = {
  id: string;
  projectId: string;
  title: string;
  mode: "STEP" | "BATCH";
  status: "DRAFT" | "READY" | "RUNNING" | "BLOCKED" | "VERIFIED" | "DEPLOYED" | "FAILED" | "CANCELED" | "ROLLED_BACK";
  classification: "BIRTH" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "DEPLOYED";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type LifecycleModuleRef = {
  id: string;
  runId: string;
  moduleOrder: number;
  moduleType: "TECHSTACK" | "FEATURE" | "CHECK" | "DOMAIN" | "DEPLOY" | "CHANGE" | "FIX" | "ITERATE" | "TEARDOWN" | "CUSTOM";
  title: string;
  description: string;
  config: unknown;
  expectedState: string;
  actualState: string | null;
  gateRequired: boolean;
  completionPolicy: "PAUSE_ALWAYS" | "PAUSE_ON_RISK" | "CONTINUE_AUTOMATIC";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED" | "SKIPPED";
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type LifecycleRunDetailRef = {
  run: LifecycleRunRef;
  modules: LifecycleModuleRef[];
  transitions: Array<{
    id: string;
    runId: string;
    fromStatus: LifecycleRunRef["status"];
    toStatus: LifecycleRunRef["status"];
    reason: string;
    metadata: unknown;
    createdAt: string;
  }>;
  evidences: Array<{
    id: string;
    runId: string;
    moduleId: string | null;
    kind: string;
    summary: string;
    details: unknown;
    createdAt: string;
  }>;
};

export type AgentQuestion = {
  id: string;
  runId: string;
  content: string;
  createdAt: string;
};

export type AgentAnswer = {
  questionId: string;
  content: string;
  createdAt: string;
};

export type AgentRunSummary = {
  id: string;
  projectId: string;
  status: AgentRunStatus;
  trigger: string;
  workspacePath: string;
  command: string;
  promptPath: string;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  failureReason: string | null;
  heartbeatAt: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};
