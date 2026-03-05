"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type UserGitHubConfigEditorProps = {
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

export function UserGitHubConfigEditor({ initialConfig }: UserGitHubConfigEditorProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [username, setUsername] = useState(initialConfig.username ?? "");
  const [email, setEmail] = useState(initialConfig.email ?? "");
  const [busy, setBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenState, setTokenState] = useState({
    hasApiToken: initialConfig.hasApiToken,
    tokenHint: initialConfig.tokenHint,
  });
  const [health, setHealth] = useState({
    checkedAt: initialConfig.lastCheckedAt,
    status: initialConfig.lastHealthStatus,
    message: initialConfig.lastHealthMessage,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/v1/user/config/github", {
      method: "PUT",
      headers: { "content-type": "application/json" },
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
      setError(payload.error?.message ?? "Unable to save GitHub credentials");
      setBusy(false);
      return;
    }
    setTokenState(payload.data);
    setApiToken("");
    setClearApiToken(false);
    setSuccess("User GitHub credentials updated.");
    setBusy(false);
  }

  async function onHealthcheck() {
    setHealthBusy(true);
    setError("");
    const response = await fetch("/api/v1/user/config/github/healthcheck", {
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
      <h2>User GitHub Config</h2>
      <p>These credentials are private to your account and used for project-bound GitHub clone/push modules.</p>

      <label className="checkbox-label">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enable my GitHub credentials for agent runtime
      </label>

      <label>GitHub Username</label>
      <input value={username} onChange={(event) => setUsername(event.target.value)} />

      <label>GitHub Email</label>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />

      <label>GitHub API Token (optional update)</label>
      <input
        type="password"
        value={apiToken}
        onChange={(event) => setApiToken(event.target.value)}
        placeholder={tokenState.hasApiToken ? `Stored: ${tokenState.tokenHint ?? "configured"}` : "No token stored"}
      />

      <label className="checkbox-label">
        <input type="checkbox" checked={clearApiToken} onChange={(event) => setClearApiToken(event.target.checked)} />
        Clear stored token
      </label>

      <div className="task-admin-actions">
        <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save My GitHub Config"}</button>
        <button type="button" className="inline-action" onClick={onHealthcheck} disabled={healthBusy}>
          {healthBusy ? "Checking..." : "Run Healthcheck"}
        </button>
      </div>

      <div className="bootstrap-box">
        <p>
          <strong>Token:</strong> {tokenState.hasApiToken ? `Configured (${tokenState.tokenHint ?? "hidden"})` : "Not configured"}
        </p>
        <p>
          <strong>Health:</strong> {health.status ?? "n/a"} ({formatDate(health.checkedAt)})
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
