import type { TaskStatus, UserRole } from "@prisma/client";

export type ProjectDTO = {
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

export type TaskDTO = {
  id: string;
  visualId: string;
  projectId: string;
  title: string;
  executionOrder: number;
  status: TaskStatus;
  requiresOperatorFeedback: boolean;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentationDTO = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  version: number;
  createdAt: string;
};

export type LifecycleRunDTO = {
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

export type LifecycleModuleDTO = {
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

export type LifecycleTransitionDTO = {
  id: string;
  runId: string;
  fromStatus: LifecycleRunDTO["status"];
  toStatus: LifecycleRunDTO["status"];
  reason: string;
  metadata: unknown;
  createdAt: string;
};

export type LifecycleEvidenceDTO = {
  id: string;
  runId: string;
  moduleId: string | null;
  kind: string;
  summary: string;
  details: unknown;
  createdAt: string;
};

export type LifecycleRunDetailDTO = {
  run: LifecycleRunDTO;
  modules: LifecycleModuleDTO[];
  transitions: LifecycleTransitionDTO[];
  evidences: LifecycleEvidenceDTO[];
};

export type ApiKeyListItemDTO = {
  id: string;
  name: string;
  keyPrefix: string;
  createdByUserId: string;
  projectId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type UserSessionDTO = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};
