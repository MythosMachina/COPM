import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NotFoundError, UnauthorizedError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import type { ApiKeyListItemDTO } from "@/types/domain";

function toListItemDTO(item: {
  id: string;
  name: string;
  keyPrefix: string;
  createdByUserId: string;
  projectId: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}): ApiKeyListItemDTO {
  return {
    id: item.id,
    name: item.name,
    keyPrefix: item.keyPrefix,
    createdByUserId: item.createdByUserId,
    projectId: item.projectId,
    createdAt: item.createdAt.toISOString(),
    lastUsedAt: item.lastUsedAt ? item.lastUsedAt.toISOString() : null,
    revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
  };
}

export async function createApiKey(input: { name: string; createdByUserId: string; projectId?: string }) {
  const rawToken = `ck_${crypto.randomBytes(32).toString("hex")}`;
  const keyPrefix = rawToken.slice(0, 14);
  const keyHash = await bcrypt.hash(rawToken, 12);

  const created = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyHash,
      keyPrefix,
      createdByUserId: input.createdByUserId,
      projectId: input.projectId ?? null,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  return {
    ...created,
    token: rawToken,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listApiKeys(): Promise<ApiKeyListItemDTO[]> {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdByUserId: true,
      projectId: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return keys.map(toListItemDTO);
}

export async function verifyApiKeyToken(token: string): Promise<{
  id: string;
  projectId: string | null;
  createdByUserId: string;
}> {
  const prefix = token.slice(0, 14);
  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix: prefix,
      revokedAt: null,
    },
    select: {
      id: true,
      keyHash: true,
      projectId: true,
      createdByUserId: true,
    },
  });

  if (candidates.length === 0) {
    throw new UnauthorizedError("Invalid API key");
  }

  let matched: { id: string; projectId: string | null; createdByUserId: string } | null = null;
  for (const candidate of candidates) {
    const valid = await bcrypt.compare(token, candidate.keyHash);
    if (valid) {
      matched = { id: candidate.id, projectId: candidate.projectId, createdByUserId: candidate.createdByUserId };
      break;
    }
  }

  if (!matched) {
    throw new UnauthorizedError("Invalid API key");
  }

  const updated = await prisma.apiKey.update({
    where: { id: matched.id },
    data: { lastUsedAt: new Date() },
    select: { id: true },
  });

  if (!updated) {
    throw new NotFoundError("API key not found");
  }

  return matched;
}
