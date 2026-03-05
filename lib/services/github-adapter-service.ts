import { ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, toTokenHint } from "@/lib/security/secret-crypto";

export type GitHubAdapterDTO = {
  enabled: boolean;
  hasApiToken: boolean;
  tokenHint: string | null;
  username: string | null;
  email: string | null;
  lastCheckedAt: string | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserGitHubConfigDTO = {
  enabled: boolean;
  hasApiToken: boolean;
  tokenHint: string | null;
  username: string | null;
  email: string | null;
  lastCheckedAt: string | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
};

type UpdateGitHubAdapterInput = {
  enabled: boolean;
  apiToken?: string;
  clearApiToken?: boolean;
  username?: string | null;
  email?: string | null;
};

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ValidationError("GitHub email must be valid");
  }
  return normalized;
}

function toDto(config: {
  enabled: boolean;
  encryptedApiToken: string | null;
  tokenHint: string | null;
  username: string | null;
  email: string | null;
  lastCheckedAt: Date | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): GitHubAdapterDTO {
  return {
    enabled: config.enabled,
    hasApiToken: Boolean(config.encryptedApiToken),
    tokenHint: config.tokenHint,
    username: config.username,
    email: config.email,
    lastCheckedAt: config.lastCheckedAt ? config.lastCheckedAt.toISOString() : null,
    lastHealthStatus: config.lastHealthStatus,
    lastHealthMessage: config.lastHealthMessage,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

async function getOrCreateConfigRow() {
  const existing = await prisma.gitHubAdapterConfig.findFirst();
  if (existing) {
    return existing;
  }

  return prisma.gitHubAdapterConfig.create({
    data: {
      enabled: false,
    },
  });
}

export async function getGitHubAdapterConfig(): Promise<GitHubAdapterDTO> {
  const row = await getOrCreateConfigRow();
  return toDto(row);
}

export async function updateGitHubAdapterConfig(input: UpdateGitHubAdapterInput): Promise<GitHubAdapterDTO> {
  const row = await getOrCreateConfigRow();
  const data: {
    enabled: boolean;
    encryptedApiToken?: string | null;
    tokenHint?: string | null;
    username?: string | null;
    email?: string | null;
  } = {
    enabled: input.enabled,
  };

  if (input.clearApiToken) {
    data.encryptedApiToken = null;
    data.tokenHint = null;
  } else if (input.apiToken && input.apiToken.trim()) {
    data.encryptedApiToken = encryptSecret(input.apiToken);
    data.tokenHint = toTokenHint(input.apiToken);
  }

  if (input.username !== undefined) {
    data.username = normalizeOptionalString(input.username);
  }
  if (input.email !== undefined) {
    data.email = normalizeEmail(input.email);
  }

  const updated = await prisma.gitHubAdapterConfig.update({
    where: { id: row.id },
    data,
  });
  return toDto(updated);
}

export async function runGitHubHealthcheck(): Promise<{
  ok: boolean;
  message: string;
  statusCode: number | null;
  checkedAt: string;
}> {
  const row = await getOrCreateConfigRow();
  if (!row.encryptedApiToken) {
    throw new ValidationError("GitHub API token is not configured");
  }

  const token = decryptSecret(row.encryptedApiToken);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "copm-github-adapter",
        accept: "application/vnd.github+json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const checkedAt = new Date();
    const ok = response.ok;
    const message = ok ? "GitHub connection healthy" : `GitHub responded with HTTP ${response.status}`;
    await prisma.gitHubAdapterConfig.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: checkedAt,
        lastHealthStatus: ok ? "OK" : "ERROR",
        lastHealthMessage: message,
      },
    });

    return {
      ok,
      message,
      statusCode: response.status,
      checkedAt: checkedAt.toISOString(),
    };
  } catch (error) {
    const checkedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    await prisma.gitHubAdapterConfig.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: checkedAt,
        lastHealthStatus: "ERROR",
        lastHealthMessage: message,
      },
    });

    return {
      ok: false,
      message,
      statusCode: null,
      checkedAt: checkedAt.toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getGitHubAdapterRuntimeSecrets(): Promise<{
  enabled: boolean;
  apiToken: string | null;
  username: string | null;
  email: string | null;
}> {
  const row = await getOrCreateConfigRow();
  return {
    enabled: row.enabled,
    apiToken: row.enabled && row.encryptedApiToken ? decryptSecret(row.encryptedApiToken) : null,
    username: row.username ?? null,
    email: row.email ?? null,
  };
}

function toUserDto(user: {
  githubEnabled: boolean;
  githubEncryptedApiToken: string | null;
  githubTokenHint: string | null;
  githubUsername: string | null;
  githubEmail: string | null;
  githubLastCheckedAt: Date | null;
  githubLastHealthStatus: string | null;
  githubLastHealthMessage: string | null;
}): UserGitHubConfigDTO {
  return {
    enabled: user.githubEnabled,
    hasApiToken: Boolean(user.githubEncryptedApiToken),
    tokenHint: user.githubTokenHint,
    username: user.githubUsername,
    email: user.githubEmail,
    lastCheckedAt: user.githubLastCheckedAt ? user.githubLastCheckedAt.toISOString() : null,
    lastHealthStatus: user.githubLastHealthStatus,
    lastHealthMessage: user.githubLastHealthMessage,
  };
}

export async function getUserGitHubConfig(userId: string): Promise<UserGitHubConfigDTO> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      githubEnabled: true,
      githubEncryptedApiToken: true,
      githubTokenHint: true,
      githubUsername: true,
      githubEmail: true,
      githubLastCheckedAt: true,
      githubLastHealthStatus: true,
      githubLastHealthMessage: true,
    },
  });
  if (!user) {
    throw new ValidationError("User not found");
  }
  return toUserDto(user);
}

export async function updateUserGitHubConfig(
  userId: string,
  input: {
    enabled: boolean;
    apiToken?: string;
    clearApiToken?: boolean;
    username?: string | null;
    email?: string | null;
  },
): Promise<UserGitHubConfigDTO> {
  const data: {
    githubEnabled: boolean;
    githubEncryptedApiToken?: string | null;
    githubTokenHint?: string | null;
    githubUsername?: string | null;
    githubEmail?: string | null;
  } = {
    githubEnabled: input.enabled,
  };

  if (input.clearApiToken) {
    data.githubEncryptedApiToken = null;
    data.githubTokenHint = null;
  } else if (input.apiToken && input.apiToken.trim()) {
    data.githubEncryptedApiToken = encryptSecret(input.apiToken);
    data.githubTokenHint = toTokenHint(input.apiToken);
  }

  if (input.username !== undefined) {
    data.githubUsername = normalizeOptionalString(input.username);
  }
  if (input.email !== undefined) {
    data.githubEmail = normalizeEmail(input.email);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      githubEnabled: true,
      githubEncryptedApiToken: true,
      githubTokenHint: true,
      githubUsername: true,
      githubEmail: true,
      githubLastCheckedAt: true,
      githubLastHealthStatus: true,
      githubLastHealthMessage: true,
    },
  });

  return toUserDto(updated);
}

export async function runUserGitHubHealthcheck(userId: string): Promise<{
  ok: boolean;
  message: string;
  statusCode: number | null;
  checkedAt: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      githubEncryptedApiToken: true,
    },
  });
  if (!user?.githubEncryptedApiToken) {
    throw new ValidationError("GitHub API token is not configured");
  }

  const token = decryptSecret(user.githubEncryptedApiToken);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "copm-github-user-config",
        accept: "application/vnd.github+json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const checkedAt = new Date();
    const ok = response.ok;
    const message = ok ? "GitHub connection healthy" : `GitHub responded with HTTP ${response.status}`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubLastCheckedAt: checkedAt,
        githubLastHealthStatus: ok ? "OK" : "ERROR",
        githubLastHealthMessage: message,
      },
    });

    return {
      ok,
      message,
      statusCode: response.status,
      checkedAt: checkedAt.toISOString(),
    };
  } catch (error) {
    const checkedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubLastCheckedAt: checkedAt,
        githubLastHealthStatus: "ERROR",
        githubLastHealthMessage: message,
      },
    });

    return {
      ok: false,
      message,
      statusCode: null,
      checkedAt: checkedAt.toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getGitHubRuntimeSecretsForProject(projectId: string): Promise<{
  enabled: boolean;
  apiToken: string | null;
  username: string | null;
  email: string | null;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      createdBy: {
        select: {
          githubEnabled: true,
          githubEncryptedApiToken: true,
          githubUsername: true,
          githubEmail: true,
        },
      },
    },
  });

  if (!project) {
    throw new ValidationError("Project not found");
  }

  const ownerConfig = project.createdBy;
  if (!ownerConfig.githubEnabled || !ownerConfig.githubEncryptedApiToken) {
    return {
      enabled: false,
      apiToken: null,
      username: ownerConfig.githubUsername ?? null,
      email: ownerConfig.githubEmail ?? null,
    };
  }

  return {
    enabled: true,
    apiToken: decryptSecret(ownerConfig.githubEncryptedApiToken),
    username: ownerConfig.githubUsername ?? null,
    email: ownerConfig.githubEmail ?? null,
  };
}
