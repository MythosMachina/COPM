import type { Documentation } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import type { DocumentationDTO } from "@/types/domain";

type CreateDocumentationInput = {
  name: string;
  content: string;
};

type UpdateDocumentationInput = {
  content: string;
};

function toDocumentationDTO(document: Documentation): DocumentationDTO {
  return {
    id: document.id,
    projectId: document.projectId,
    name: document.name,
    content: document.content,
    version: document.version,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function listDocumentationByProject(projectId: string): Promise<DocumentationDTO[]> {
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  const docs = await prisma.documentation.findMany({
    where: { projectId },
    orderBy: [{ name: "asc" }, { version: "desc" }],
  });

  return docs.map(toDocumentationDTO);
}

export async function listLatestDocumentationByProject(projectId: string): Promise<DocumentationDTO[]> {
  const allDocs = await listDocumentationByProject(projectId);
  const latestByName = new Map<string, DocumentationDTO>();

  for (const doc of allDocs) {
    if (!latestByName.has(doc.name)) {
      latestByName.set(doc.name, doc);
    }
  }

  return Array.from(latestByName.values());
}

export async function getDocumentationById(id: string): Promise<DocumentationDTO> {
  const doc = await prisma.documentation.findUnique({ where: { id } });
  if (!doc) {
    throw new NotFoundError("Documentation not found");
  }

  return toDocumentationDTO(doc);
}

export async function listDocumentationHistory(projectId: string, name: string): Promise<DocumentationDTO[]> {
  const docs = await prisma.documentation.findMany({
    where: { projectId, name },
    orderBy: { version: "desc" },
  });

  return docs.map(toDocumentationDTO);
}

export async function createDocumentation(
  projectId: string,
  input: CreateDocumentationInput,
): Promise<DocumentationDTO> {
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  try {
    const latest = await prisma.documentation.findFirst({
      where: { projectId, name: input.name },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const document = await prisma.documentation.create({
      data: {
        projectId,
        name: input.name,
        content: input.content,
        version: (latest?.version ?? 0) + 1,
      },
    });

    return toDocumentationDTO(document);
  } catch (error) {
    throw new ValidationError("Unable to create documentation", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function updateDocumentation(id: string, input: UpdateDocumentationInput): Promise<DocumentationDTO> {
  const existing = await prisma.documentation.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Documentation not found");
  }

  try {
    const document = await prisma.documentation.create({
      data: {
        projectId: existing.projectId,
        name: existing.name,
        content: input.content,
        version: existing.version + 1,
      },
    });

    return toDocumentationDTO(document);
  } catch (error) {
    throw new ValidationError("Unable to update documentation", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function deleteDocumentation(id: string): Promise<{ id: string }> {
  const existing = await prisma.documentation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Documentation not found");
  }

  try {
    await prisma.documentation.delete({ where: { id } });
    return { id };
  } catch (error) {
    throw new ValidationError("Unable to delete documentation", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export async function deleteDocumentationByProject(
  projectId: string,
  name?: string,
): Promise<{ deletedCount: number }> {
  const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!projectExists) {
    throw new NotFoundError("Project not found");
  }

  try {
    const result = await prisma.documentation.deleteMany({
      where: {
        projectId,
        ...(name ? { name } : {}),
      },
    });

    return { deletedCount: result.count };
  } catch (error) {
    throw new ValidationError("Unable to delete project documentation", {
      cause: error instanceof Error ? error.message : "Unknown",
    });
  }
}
