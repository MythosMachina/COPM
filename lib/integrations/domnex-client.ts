import { ValidationError } from "@/lib/api/errors";

type DomNexRequestOptions = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
};

export type DomNexHostInput = {
  domain: string;
  subdomain: string;
  upstream: string;
  insecureTls?: boolean;
  haEnabled?: boolean;
};

export type DomNexHostRecord = {
  id: string;
  fqdn: string;
  upstream: string;
  raw: unknown;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function toRecord(raw: unknown): DomNexHostRecord | null {
  const obj = asObject(raw);
  const id = String(obj.id ?? obj.hostId ?? "").trim();
  const fqdn = String(obj.fqdn ?? obj.hostname ?? obj.host ?? "").trim();
  const upstream = String(obj.upstream ?? obj.target ?? "").trim();
  if (!id || !fqdn) {
    return null;
  }

  return {
    id,
    fqdn,
    upstream,
    raw,
  };
}

export class DomNexClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token.trim();
    if (!this.baseUrl || !this.token) {
      throw new ValidationError("DomNex client requires baseUrl and token");
    }
  }

  private async request(path: string, options: DomNexRequestOptions = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    const text = await response.text();
    const payload = text ? (() => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    })() : null;

    if (!response.ok) {
      throw new ValidationError(`DomNex request failed (${response.status})`, {
        path,
        status: response.status,
        payload,
      });
    }

    return payload;
  }

  async getMe(): Promise<unknown> {
    return this.request("/api/v1/me");
  }

  async listApexDomains(): Promise<string[]> {
    const paths = ["/api/v1/domains", "/api/v1/zones", "/api/v1/dns/domains"];
    const found = new Set<string>();

    const extract = (payload: unknown) => {
      const root = asObject(payload);
      const candidates = Array.isArray(payload)
        ? payload
        : Array.isArray(root.items)
          ? root.items
          : Array.isArray(root.data)
            ? root.data
            : Array.isArray(root.domains)
              ? root.domains
              : [];

      for (const item of candidates) {
        const obj = asObject(item);
        const value = String(
          obj.domain ?? obj.name ?? obj.zone ?? obj.apexDomain ?? obj.rootDomain ?? "",
        )
          .trim()
          .toLowerCase();
        if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) {
          found.add(value);
        }
      }
    };

    for (const path of paths) {
      try {
        const payload = await this.request(path);
        extract(payload);
      } catch {
        // Try next known path.
      }
    }

    return [...found].sort((a, b) => a.localeCompare(b));
  }

  async listHosts(): Promise<DomNexHostRecord[]> {
    const payload = await this.request("/api/v1/hosts");
    const root = asObject(payload);
    const maybeItems = root.items;
    const list = Array.isArray(maybeItems)
      ? maybeItems
      : Array.isArray(payload)
        ? payload
        : [];

    return list.map(toRecord).filter((entry): entry is DomNexHostRecord => entry !== null);
  }

  async preflightHost(input: DomNexHostInput): Promise<{ ready: boolean; raw: unknown }> {
    const payload = await this.request("/api/v1/hosts/preflight", {
      method: "POST",
      body: {
        domain: input.domain,
        subdomain: input.subdomain,
        upstream: input.upstream,
        insecureTls: input.insecureTls ?? false,
        haEnabled: input.haEnabled ?? false,
      },
    });

    const obj = asObject(payload);
    const ready = Boolean(obj.ready ?? obj.ok ?? true);
    return { ready, raw: payload };
  }

  async createHost(input: DomNexHostInput): Promise<DomNexHostRecord> {
    const payload = await this.request("/api/v1/hosts", {
      method: "POST",
      body: {
        domain: input.domain,
        subdomain: input.subdomain,
        upstream: input.upstream,
        insecureTls: input.insecureTls ?? false,
        haEnabled: input.haEnabled ?? false,
      },
    });

    const record = toRecord(payload);
    if (record) {
      return record;
    }

    const obj = asObject(payload);
    const nested = toRecord(obj.item ?? obj.host ?? obj.data);
    if (nested) {
      return nested;
    }

    throw new ValidationError("DomNex create host succeeded but response shape was unsupported", payload);
  }

  async findHostByFqdn(fqdn: string): Promise<DomNexHostRecord | null> {
    const needle = fqdn.trim().toLowerCase();
    if (!needle) {
      return null;
    }

    const hosts = await this.listHosts();
    return hosts.find((host) => host.fqdn.toLowerCase() === needle) ?? null;
  }

  async deleteHostById(hostId: string): Promise<void> {
    const value = hostId.trim();
    if (!value) {
      throw new ValidationError("hostId is required");
    }
    await this.request(`/api/v1/hosts/${encodeURIComponent(value)}`, { method: "DELETE" });
  }

  async deleteHostByFqdn(fqdn: string): Promise<{ deleted: boolean; hostId?: string }> {
    const existing = await this.findHostByFqdn(fqdn);
    if (!existing) {
      return { deleted: false };
    }
    await this.deleteHostById(existing.id);
    return { deleted: true, hostId: existing.id };
  }
}
