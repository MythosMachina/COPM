import { AgentRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardProjectOverviewDTO = {
  id: string;
  visualId: string;
  name: string;
  target: string;
  autonomousAgentEnabled: boolean;
  latestAgentStatus: AgentRunStatus | null;
  latestAgentUpdatedAt: string | null;
  latestAgentFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
  lifecycleRunCount: number;
  documentationCount: number;
};

export type DashboardSummaryDTO = {
  projectCount: number;
  lifecycleRunCount: number;
  documentationCount: number;
  agentRunningCount: number;
  agentWaitingCount: number;
  agentFailedCount: number;
};

type ListDashboardProjectsInput = {
  query?: string;
  statusFilter?: "all" | "running" | "waiting" | "failed" | "idle";
  actorUserId?: string;
  actorRole?: "ADMIN" | "USER";
};

export async function listDashboardProjects(input: ListDashboardProjectsInput = {}) {
  const query = input.query?.trim();
  const statusFilter = input.statusFilter ?? "all";
  const whereQuery = query
    ? {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            target: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : {};
  const whereScope =
    input.actorRole === "USER" && input.actorUserId
      ? {
          createdByUserId: input.actorUserId,
        }
      : {};

  const projects = await prisma.project.findMany({
    where: {
      ...whereQuery,
      ...whereScope,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      visualId: true,
      name: true,
      target: true,
      autonomousAgentEnabled: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          documentation: true,
          lifecycleRuns: true,
        },
      },
    },
  });

  if (projects.length === 0) {
    return {
      projects: [] as DashboardProjectOverviewDTO[],
      summary: {
        projectCount: 0,
        lifecycleRunCount: 0,
        documentationCount: 0,
        agentRunningCount: 0,
        agentWaitingCount: 0,
        agentFailedCount: 0,
      } satisfies DashboardSummaryDTO,
    };
  }

  const latestAgentRuns = await prisma.agentRun.findMany({
    where: {
      projectId: { in: projects.map((project) => project.id) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      projectId: true,
      status: true,
      updatedAt: true,
      failureReason: true,
    },
  });
  const agentByProject = new Map<
    string,
    { status: AgentRunStatus; updatedAt: Date; failureReason: string | null }
  >();
  for (const run of latestAgentRuns) {
    if (!agentByProject.has(run.projectId)) {
      agentByProject.set(run.projectId, {
        status: run.status,
        updatedAt: run.updatedAt,
        failureReason: run.failureReason,
      });
    }
  }

  const allProjects = projects.map((project) => {
    const latestAgent = agentByProject.get(project.id);
    return {
      id: project.id,
      visualId: project.visualId,
      name: project.name,
      target: project.target,
      autonomousAgentEnabled: project.autonomousAgentEnabled,
      latestAgentStatus: latestAgent?.status ?? null,
      latestAgentUpdatedAt: latestAgent ? latestAgent.updatedAt.toISOString() : null,
      latestAgentFailureReason: latestAgent?.failureReason ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      lifecycleRunCount: project._count.lifecycleRuns,
      documentationCount: project._count.documentation,
    } satisfies DashboardProjectOverviewDTO;
  });

  const filteredProjects = allProjects.filter((project) => {
    if (statusFilter === "running") {
      return project.latestAgentStatus === "RUNNING" || project.latestAgentStatus === "QUEUED";
    }
    if (statusFilter === "waiting") {
      return project.latestAgentStatus === "WAITING_INPUT";
    }
    if (statusFilter === "failed") {
      return project.latestAgentStatus === "FAILED";
    }
    if (statusFilter === "idle") {
      return project.latestAgentStatus === null || project.latestAgentStatus === "DONE";
    }
    return true;
  });

  const summary = filteredProjects.reduce(
    (acc, project) => ({
      projectCount: acc.projectCount + 1,
      lifecycleRunCount: acc.lifecycleRunCount + project.lifecycleRunCount,
      documentationCount: acc.documentationCount + project.documentationCount,
      agentRunningCount:
        acc.agentRunningCount +
        (project.latestAgentStatus === "RUNNING" || project.latestAgentStatus === "QUEUED" ? 1 : 0),
      agentWaitingCount: acc.agentWaitingCount + (project.latestAgentStatus === "WAITING_INPUT" ? 1 : 0),
      agentFailedCount: acc.agentFailedCount + (project.latestAgentStatus === "FAILED" ? 1 : 0),
    }),
    {
      projectCount: 0,
      lifecycleRunCount: 0,
      documentationCount: 0,
      agentRunningCount: 0,
      agentWaitingCount: 0,
      agentFailedCount: 0,
    } satisfies DashboardSummaryDTO,
  );

  return {
    projects: filteredProjects,
    summary,
  };
}
