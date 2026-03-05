"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type DomNexAdapterEditorProps = {
  initialConfig: {
    enabled: boolean;
    baseUrl: string;
    defaultDomain: string | null;
    apexDomains: string[];
    hasApiToken: boolean;
    tokenHint: string | null;
    lastCheckedAt: string | null;
    lastHealthStatus: string | null;
    lastHealthMessage: string | null;
  };
};

function formatDate(value: string | null): string {
  if (!value) {
    return "never";
  }
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DomNexAdapterEditor({ initialConfig }: DomNexAdapterEditorProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [baseUrl, setBaseUrl] = useState(initialConfig.baseUrl);
  const [defaultDomain, setDefaultDomain] = useState(initialConfig.defaultDomain ?? "");
  const [apexDomainsInput, setApexDomainsInput] = useState((initialConfig.apexDomains ?? []).join("\n"));
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [health, setHealth] = useState({
    checkedAt: initialConfig.lastCheckedAt,
    status: initialConfig.lastHealthStatus,
    message: initialConfig.lastHealthMessage,
  });
  const [tokenState, setTokenState] = useState({
    hasApiToken: initialConfig.hasApiToken,
    tokenHint: initialConfig.tokenHint,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/v1/admin/system/integrations/domnex", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        enabled,
        baseUrl,
        defaultDomain: defaultDomain || null,
        apexDomains: apexDomainsInput
          .split("\n")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
        ...(clearApiToken ? { clearApiToken: true } : {}),
      }),
    });

    const payload = (await response.json()) as {
      success: boolean;
      data?: { hasApiToken: boolean; tokenHint: string | null };
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Unable to save DomNex adapter config");
      setBusy(false);
      return;
    }

    setTokenState({
      hasApiToken: payload.data.hasApiToken,
      tokenHint: payload.data.tokenHint,
    });
    setApiToken("");
    setClearApiToken(false);
    setSuccess("DomNex adapter configuration updated.");
    setBusy(false);
  }

  async function syncApexDomains() {
    setSyncBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/v1/admin/system/integrations/domnex/apex-domains/sync", {
      method: "POST",
    });

    const payload = (await response.json()) as {
      success: boolean;
      data?: { domains: string[] };
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Unable to sync apex domains from DomNex API");
      setSyncBusy(false);
      return;
    }

    setApexDomainsInput(payload.data.domains.join("\n"));
    setSuccess(`Synced ${payload.data.domains.length} apex domain(s) from DomNex API.`);
    setSyncBusy(false);
  }

  async function runHealthcheck() {
    setHealthBusy(true);
    setError("");

    const response = await fetch("/api/v1/admin/system/integrations/domnex/healthcheck", {
      method: "POST",
    });

    const payload = (await response.json()) as {
      success: boolean;
      data?: { ok: boolean; message: string; checkedAt: string };
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "DomNex healthcheck failed");
      setHealthBusy(false);
      return;
    }

    setHealth({
      checkedAt: payload.data.checkedAt,
      status: payload.data.ok ? "OK" : "ERROR",
      message: payload.data.message,
    });
    setHealthBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="card preset-editor">
      <h2>DomNex Adapter</h2>
      <p>Configure global DomNex connection and credentials for secure runtime use in automation workers.</p>

      <label className="checkbox-label">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Adapter enabled
      </label>

      <label htmlFor="domnex-base-url">DomNex Base URL</label>
      <input
        id="domnex-base-url"
        type="url"
        value={baseUrl}
        onChange={(event) => setBaseUrl(event.target.value)}
        required
      />

      <label htmlFor="domnex-api-token">DomNex API Token (optional update)</label>
      <input
        id="domnex-api-token"
        type="password"
        value={apiToken}
        onChange={(event) => setApiToken(event.target.value)}
        placeholder={tokenState.hasApiToken ? `Stored: ${tokenState.tokenHint ?? "configured"}` : "No token stored"}
      />

      <label className="checkbox-label">
        <input type="checkbox" checked={clearApiToken} onChange={(event) => setClearApiToken(event.target.checked)} />
        Clear stored API token
      </label>

      <label htmlFor="domnex-default-domain">Default Domain (for PRJ-* auto FQDN)</label>
      <input
        id="domnex-default-domain"
        type="text"
        value={defaultDomain}
        onChange={(event) => setDefaultDomain(event.target.value)}
        placeholder="example.com"
      />

      <label htmlFor="domnex-apex-domains">Managed Apex Domains (one per line)</label>
      <textarea
        id="domnex-apex-domains"
        value={apexDomainsInput}
        onChange={(event) => setApexDomainsInput(event.target.value)}
        rows={5}
        placeholder={"example.com\nexample.net"}
      />

      <div className="task-admin-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save DomNex Adapter"}
        </button>
        <button type="button" className="inline-action" onClick={runHealthcheck} disabled={healthBusy}>
          {healthBusy ? "Checking..." : "Run Healthcheck"}
        </button>
        <button type="button" className="inline-action" onClick={syncApexDomains} disabled={syncBusy}>
          {syncBusy ? "Syncing..." : "Sync Apex Domains"}
        </button>
      </div>

      <div className="bootstrap-box">
        <p>
          <strong>Token state:</strong> {tokenState.hasApiToken ? `Configured (${tokenState.tokenHint ?? "hidden"})` : "Not configured"}
        </p>
        <p>
          <strong>Last health:</strong> {health.status ?? "n/a"} ({formatDate(health.checkedAt)})
        </p>
        <p>
          <strong>Default domain:</strong> {defaultDomain || "not configured"}
        </p>
        <p>
          <strong>Message:</strong> {health.message ?? "n/a"}
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </form>
  );
}
