"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type GitHubAdapterEditorProps = {
  initialConfig: {
    enabled: boolean;
    hasApiToken: boolean;
    tokenHint: string | null;
    username: string | null;
    email: string | null;
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

export function GitHubAdapterEditor({ initialConfig }: GitHubAdapterEditorProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [username, setUsername] = useState(initialConfig.username ?? "");
  const [email, setEmail] = useState(initialConfig.email ?? "");
  const [busy, setBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
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

    const response = await fetch("/api/v1/admin/system/integrations/github", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        enabled,
        username: username || null,
        email: email || null,
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
      setError(payload.error?.message ?? "Unable to save GitHub adapter config");
      setBusy(false);
      return;
    }

    setTokenState({
      hasApiToken: payload.data.hasApiToken,
      tokenHint: payload.data.tokenHint,
    });
    setApiToken("");
    setClearApiToken(false);
    setSuccess("GitHub adapter configuration updated.");
    setBusy(false);
  }

  async function runHealthcheck() {
    setHealthBusy(true);
    setError("");
    const response = await fetch("/api/v1/admin/system/integrations/github/healthcheck", {
      method: "POST",
    });

    const payload = (await response.json()) as {
      success: boolean;
      data?: { ok: boolean; message: string; checkedAt: string };
      error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "GitHub healthcheck failed");
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
      <h2>GitHub Adapter</h2>
      <p>Configure central GitHub credentials for prefab push/release automation.</p>

      <label className="checkbox-label">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Adapter enabled
      </label>

      <label htmlFor="github-username">GitHub Username</label>
      <input id="github-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />

      <label htmlFor="github-email">GitHub Email</label>
      <input id="github-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />

      <label htmlFor="github-api-token">GitHub API Token (optional update)</label>
      <input
        id="github-api-token"
        type="password"
        value={apiToken}
        onChange={(event) => setApiToken(event.target.value)}
        placeholder={tokenState.hasApiToken ? `Stored: ${tokenState.tokenHint ?? "configured"}` : "No token stored"}
      />

      <label className="checkbox-label">
        <input type="checkbox" checked={clearApiToken} onChange={(event) => setClearApiToken(event.target.checked)} />
        Clear stored API token
      </label>

      <div className="task-admin-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save GitHub Adapter"}
        </button>
        <button type="button" className="inline-action" onClick={runHealthcheck} disabled={healthBusy}>
          {healthBusy ? "Checking..." : "Run Healthcheck"}
        </button>
      </div>

      <div className="bootstrap-box">
        <p>
          <strong>Token state:</strong> {tokenState.hasApiToken ? `Configured (${tokenState.tokenHint ?? "hidden"})` : "Not configured"}
        </p>
        <p>
          <strong>Identity:</strong> {username || "n/a"} / {email || "n/a"}
        </p>
        <p>
          <strong>Last health:</strong> {health.status ?? "n/a"} ({formatDate(health.checkedAt)})
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
