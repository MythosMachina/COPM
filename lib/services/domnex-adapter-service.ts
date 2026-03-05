import { ValidationError } from "@/lib/api/errors";
import { DomNexClient } from "@/lib/integrations/domnex-client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, toTokenHint } from "@/lib/security/secret-crypto";

const DEFAULT_BASE_URL = "http://127.0.0.1:8443";

export type DomNexAdapterDTO = {
  enabled: boolean;
  baseUrl: string;
  defaultDomain: string | null;
  apexDomains: string[];
  hasApiToken: boolean;
  tokenHint: string | null;
  lastCheckedAt: string | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpdateDomNexAdapterInput = {
  enabled: boolean;
  baseUrl: string;
  defaultDomain?: string | null;
  apexDomains?: string[];
  apiToken?: string;
  clearApiToken?: boolean;
};

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("DomNex baseUrl is required");
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    throw new ValidationError("DomNex baseUrl must be a valid URL");
  }
}

function normalizeDefaultDomain(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    return null;
  }

  const plain = trimmed.replace(/^\.+|\.+$/g, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(plain)) {
    throw new ValidationError("DomNex defaultDomain must be a valid domain");
  }

  return plain;
}

function toDto(config: {
  enabled: boolean;
  baseUrl: string;
  defaultDomain: string | null;
  encryptedApiToken: string | null;
  tokenHint: string | null;
  lastCheckedAt: Date | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DomNexAdapterDTO {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    defaultDomain: config.defaultDomain,
    apexDomains: [],
    hasApiToken: Boolean(config.encryptedApiToken),
    tokenHint: config.tokenHint,
    lastCheckedAt: config.lastCheckedAt ? config.lastCheckedAt.toISOString() : null,
    lastHealthStatus: config.lastHealthStatus,
    lastHealthMessage: config.lastHealthMessage,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

async function getOrCreateConfigRow() {
  const existing = await prisma.domNexAdapterConfig.findFirst();
  if (existing) {
    return existing;
  }

  return prisma.domNexAdapterConfig.create({
    data: {
      enabled: false,
      baseUrl: DEFAULT_BASE_URL,
    },
  });
}

export async function getDomNexAdapterConfig(): Promise<DomNexAdapterDTO> {
  const row = await getOrCreateConfigRow();
  const apexDomains = await prisma.domNexApexDomain.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true },
  });
  return {
    ...toDto(row),
    apexDomains: apexDomains.map((entry) => entry.domain),
  };
}

export async function updateDomNexAdapterConfig(input: UpdateDomNexAdapterInput): Promise<DomNexAdapterDTO> {
  const row = await getOrCreateConfigRow();
  const data: {
    enabled: boolean;
    baseUrl: string;
    defaultDomain: string | null;
    encryptedApiToken?: string | null;
    tokenHint?: string | null;
  } = {
    enabled: input.enabled,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    defaultDomain: normalizeDefaultDomain(input.defaultDomain),
  };

  if (input.clearApiToken) {
    data.encryptedApiToken = null;
    data.tokenHint = null;
  } else if (input.apiToken && input.apiToken.trim()) {
    data.encryptedApiToken = encryptSecret(input.apiToken);
    data.tokenHint = toTokenHint(input.apiToken);
  }

  const normalizedApexDomains = [
    ...new Set(
      (input.apexDomains ?? [])
        .map((value) => normalizeDefaultDomain(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const updated = await prisma.$transaction(async (tx) => {
    const updatedRow = await tx.domNexAdapterConfig.update({
      where: { id: row.id },
      data,
    });

    if (input.apexDomains !== undefined) {
      await tx.domNexApexDomain.deleteMany({});
      if (normalizedApexDomains.length > 0) {
        await tx.domNexApexDomain.createMany({
          data: normalizedApexDomains.map((domain) => ({ domain })),
        });
      }
    } else if (data.defaultDomain) {
      await tx.domNexApexDomain.upsert({
        where: { domain: data.defaultDomain },
        update: {},
        create: { domain: data.defaultDomain },
      });
    }

    const domains = await tx.domNexApexDomain.findMany({
      orderBy: { domain: "asc" },
      select: { domain: true },
    });
    return {
      ...toDto(updatedRow),
      apexDomains: domains.map((entry) => entry.domain),
    };
  });

  return updated;
}

export async function runDomNexHealthcheck(): Promise<{
  ok: boolean;
  message: string;
  statusCode: number | null;
  checkedAt: string;
}> {
  const row = await getOrCreateConfigRow();

  if (!row.encryptedApiToken) {
    throw new ValidationError("DomNex API token is not configured");
  }

  const token = decryptSecret(row.encryptedApiToken);
  const url = `${normalizeBaseUrl(row.baseUrl)}/api/v1/me`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const checkedAt = new Date();
    const ok = response.ok;
    const message = ok
      ? "DomNex connection healthy"
      : `DomNex responded with HTTP ${response.status}`;

    await prisma.domNexAdapterConfig.update({
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

    await prisma.domNexAdapterConfig.update({
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

export async function getDomNexAdapterRuntimeSecrets(): Promise<{
  enabled: boolean;
  baseUrl: string | null;
  defaultDomain: string | null;
  apiToken: string | null;
}> {
  const row = await getOrCreateConfigRow();
  if (!row.enabled || !row.encryptedApiToken) {
    return {
      enabled: row.enabled,
      baseUrl: row.enabled ? row.baseUrl : null,
      defaultDomain: row.defaultDomain ?? null,
      apiToken: null,
    };
  }

  return {
    enabled: true,
    baseUrl: normalizeBaseUrl(row.baseUrl),
    defaultDomain: row.defaultDomain ?? null,
    apiToken: decryptSecret(row.encryptedApiToken),
  };
}

export async function syncDomNexApexDomainsFromApi(): Promise<{
  domains: string[];
  syncedAt: string;
}> {
  const runtime = await getDomNexAdapterRuntimeSecrets();
  if (!runtime.enabled || !runtime.baseUrl || !runtime.apiToken) {
    throw new ValidationError("DomNex adapter is disabled or missing runtime secrets");
  }

  const client = new DomNexClient(runtime.baseUrl, runtime.apiToken);
  const domains = await client.listApexDomains();
  if (domains.length === 0) {
    throw new ValidationError(
      "No apex domains returned by DomNex API. Verify domain endpoint availability/permissions in DomNex.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.domNexApexDomain.deleteMany({});
    await tx.domNexApexDomain.createMany({
      data: domains.map((domain) => ({ domain })),
    });
    if (!runtime.defaultDomain || !domains.includes(runtime.defaultDomain)) {
      await tx.domNexAdapterConfig.updateMany({
        data: {
          defaultDomain: domains[0] ?? runtime.defaultDomain,
        },
      });
    }
  });

  return {
    domains,
    syncedAt: new Date().toISOString(),
  };
}
