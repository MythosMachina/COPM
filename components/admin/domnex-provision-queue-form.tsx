"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type DomNexProvisionQueueFormProps = {
  projectId: string;
  autoProvisionDomain: boolean;
  provisionStatus: "DISABLED" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  provisionError: string | null;
  domnexHostId: string | null;
  initialFqdn: string;
  initialUpstreamUrl: string;
  initialInsecureTls: boolean;
  initialHaEnabled: boolean;
};

export function DomNexProvisionQueueForm(props: DomNexProvisionQueueFormProps) {
  const router = useRouter();
  const [fqdn, setFqdn] = useState("");
  const [upstreamUrl, setUpstreamUrl] = useState(props.initialUpstreamUrl);
  const [insecureTls, setInsecureTls] = useState(props.initialInsecureTls);
  const [haEnabled, setHaEnabled] = useState(props.initialHaEnabled);
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [teardownBusy, setTeardownBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function queueProvision(force: boolean) {
    const trimmedFqdn = fqdn.trim();
    const trimmedUpstream = upstreamUrl.trim();
    let upstreamHost = "";
    try {
      upstreamHost = new URL(trimmedUpstream).hostname.trim().toLowerCase();
    } catch {
      setError("Upstream URL is invalid.");
      return;
    }

    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(upstreamHost)) {
      setError("Upstream URL must be reachable from DomNex server. Do not use localhost/loopback.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/v1/admin/projects/${props.projectId}/domnex/provision`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...(trimmedFqdn ? { fqdn: trimmedFqdn } : {}),
        upstreamUrl: trimmedUpstream,
        insecureTls,
        haEnabled,
        force,
      }),
    });

    const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !payload.success) {
      setError(payload.error?.message ?? "Unable to queue DomNex provisioning");
      setBusy(false);
      return;
    }

    setSuccess(force
      ? "Retry queued with force=true (PENDING). Worker will re-provision asynchronously."
      : "Provisioning queued (PENDING). Worker will process asynchronously.");
    setBusy(false);
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await queueProvision(false);
  }

  async function onToggle(enabled: boolean) {
    setToggleBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/v1/admin/projects/${props.projectId}/domnex`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !payload.success) {
      setError(payload.error?.message ?? "Unable to update provisioning toggle");
      setToggleBusy(false);
      return;
    }
    setSuccess(enabled ? "Auto provisioning enabled." : "Auto provisioning disabled.");
    setToggleBusy(false);
    router.refresh();
  }

  async function onTeardown() {
    setTeardownBusy(true);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/v1/admin/projects/${props.projectId}/domnex/teardown`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clearFqdn: false }),
    });
    const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !payload.success) {
      setError(payload.error?.message ?? "Unable to run teardown");
      setTeardownBusy(false);
      return;
    }
    setSuccess("Teardown completed. Provisioning switched to DISABLED.");
    setTeardownBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bootstrap-box">
      <h3>DomNex Provisioning</h3>
      <p className="visual-id-pill">Status: {props.provisionStatus}</p>
      <p className="visual-id-pill">Auto Provision: {props.autoProvisionDomain ? "ON" : "OFF"}</p>
      {props.domnexHostId ? <p className="visual-id-pill">Host ID: {props.domnexHostId}</p> : null}
      {props.initialFqdn ? <p className="visual-id-pill">Current FQDN: {props.initialFqdn}</p> : null}
      {props.provisionError ? <p className="error">{props.provisionError}</p> : null}
      <label>FQDN (optional override)</label>
      <input type="text" value={fqdn} onChange={(event) => setFqdn(event.target.value)} placeholder="auto: task FQDN or prj-xxxx.default-domain" />

      <label>Upstream URL</label>
      <input type="url" value={upstreamUrl} onChange={(event) => setUpstreamUrl(event.target.value)} required />

      <label className="checkbox-label">
        <input type="checkbox" checked={insecureTls} onChange={(event) => setInsecureTls(event.target.checked)} />
        Insecure TLS
      </label>

      <label className="checkbox-label">
        <input type="checkbox" checked={haEnabled} onChange={(event) => setHaEnabled(event.target.checked)} />
        HA enabled
      </label>

      <button type="submit" disabled={busy}>{busy ? "Queueing..." : "Queue Provisioning"}</button>
      <button
        type="button"
        onClick={() => queueProvision(true)}
        disabled={busy}
      >
        Retry Provisioning (Force)
      </button>
      <button
        type="button"
        onClick={() => onToggle(!props.autoProvisionDomain)}
        disabled={toggleBusy}
      >
        {toggleBusy ? "Saving..." : props.autoProvisionDomain ? "Disable Auto Provision" : "Enable Auto Provision"}
      </button>
      <button
        type="button"
        onClick={onTeardown}
        disabled={teardownBusy}
      >
        {teardownBusy ? "Running Teardown..." : "Run Teardown"}
      </button>
      {error ? <p className="error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </form>
  );
}
