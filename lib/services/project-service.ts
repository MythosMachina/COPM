import type { Project } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { teardownDomNexProject } from "@/lib/services/domnex-provisioning-service";
import type { ProjectDTO } from "@/types/domain";

type CreateProjectInput = {
  name: string;
  target: string;
  createdByUserId: string;
  autonomousAgentEnabled?: boolean;
  autoProvisionDomain?: boolean;
  provisionUpstreamUrl?: string | null;
  provisionInsecureTls?: boolean;
  provisionHaEnabled?: boolean;
};

type UpdateProjectInput = {
  name?: string;
  target?: string;
  autonomousAgentEnabled?: boolean;
  autoProvisionDomain?: boolean;
  provisionStatus?: "DISABLED" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  provisionError?: string | null;
  fqdn?: string | null;
  domnexHostId?: string | null;
  provisionUpstreamUrl?: string | null;
  provisionInsecureTls?: boolean;
  provisionHaEnabled?: boolean;
  provisionedAt?: Date | null;
};

function toProjectDTO(project: Project): ProjectDTO {
  return {
    id: project.id,
    visualId: project.visualId,
    name: project.name,
    target: project.target,
    autonomousAgentEnabled: project.autonomousAgentEnabled,
    autoProvisionDomain: project.autoProvisionDomain,
    provisionStatus: project.provisionStatus,
    provisionError: project.provisionError ?? null,
    fqdn: project.fqdn ?? null,
    domnexHostId: project.domnexHostId ?? null,
    provisionUpstreamUrl: project.provisionUpstreamUrl ?? null,
    provisionInsecureTls: project.provisionInsecureTls,
    provisionHaEnabled: project.provisionHaEnabled,
    provisionedAt: project.provisionedAt ? project.provisionedAt.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function listProjects(): Promise<ProjectDTO[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return projects.map(toProjectDTO);
}

export async function getProjectById(id: string): Promise<ProjectDTO> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundError("Project not found");
  }

  return toProjectDTO(project);
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDTO> {
  try {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        target: input.target,
        createdByUserId: input.createdByUserId,
        autonomousAgentEnabled: input.autonomousAgentEnabled ?? false,
        autoProvisionDomain: input.autoProvisionDomain ?? false,
        provisionUpstreamUrl: input.provisionUpstreamUrl ?? null,
        provisionInsecureTls: input.provisionInsecureTls ?? false,
        provisionHaEnabled: input.provisionHaEnabled ?? false,
      },
    });

    return toProjectDTO(project);
  } catch (error) {
    throw new ValidationError("Unable to create project", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDTO> {
  await getProjectById(id);

  try {
    const project = await prisma.project.update({
      where: { id },
      data: input,
    });

    return toProjectDTO(project);
  } catch (error) {
    throw new ValidationError("Unable to update project", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function deleteProject(id: string): Promise<{ id: string }> {
  const project = await getProjectById(id);

  try {
    if (project.autoProvisionDomain || project.domnexHostId || project.fqdn) {
      try {
        await teardownDomNexProject({
          projectId: id,
          clearFqdn: false,
          reason: "project-delete",
          initiatedBy: "system",
        });
      } catch (teardownError) {
        // Project deletion must not be blocked by stale external provisioning state.
        await prisma.project.update({
          where: { id },
          data: {
            autoProvisionDomain: false,
            provisionStatus: "FAILED",
            provisionError:
              teardownError instanceof Error
                ? `Teardown skipped during delete: ${teardownError.message}`
                : "Teardown skipped during delete",
            domnexHostId: null,
          },
        });
      }
    }
    await prisma.project.delete({ where: { id } });
    return { id };
  } catch (error) {
    throw new ValidationError("Unable to delete project", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function touchProjectUpdatedAt(id: string): Promise<void> {
  await prisma.project.update({
    where: { id },
    data: { updatedAt: new Date() },
  });
}
