"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PrefabType = "DOMNEX_PROVISION" | "DOMNEX_TEARDOWN" | "GITHUB_RELEASE";

type ProjectPrefabFormProps = {
  projectId: string;
};

export function ProjectPrefabForm({ projectId }: ProjectPrefabFormProps) {
  const router = useRouter();
  const [type, setType] = useState<PrefabType>("DOMNEX_PROVISION");
  const [repoUrl, setRepoUrl] = useState("");
  const [fqdn, setFqdn] = useState("");
  const [upstreamUrl, setUpstreamUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/v1/admin/projects/${projectId}/prefabs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type,
        ...(repoUrl ? { repoUrl } : {}),
        ...(fqdn ? { fqdn } : {}),
        ...(upstreamUrl ? { upstreamUrl } : {}),
      }),
    });

    const payload = (await response.json()) as { success: boolean; error?: { message?: string } };
    if (!response.ok || !payload.success) {
      setError(payload.error?.message ?? "Unable to apply prefab");
      setBusy(false);
      return;
    }

    setSuccess(`Prefab ${type} applied (task + documentation created).`);
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bootstrap-box">
      <h3>Apply Prefab</h3>
      <label>Prefab Type</label>
      <select value={type} onChange={(event) => setType(event.target.value as PrefabType)}>
        <option value="DOMNEX_PROVISION">DomNex Provisioning</option>
        <option value="DOMNEX_TEARDOWN">DomNex Teardown</option>
        <option value="GITHUB_RELEASE">GitHub Push/Release</option>
      </select>

      <label>Repo URL (required for GitHub prefab)</label>
      <input type="url" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />

      <label>FQDN (optional)</label>
      <input type="text" value={fqdn} onChange={(event) => setFqdn(event.target.value)} />

      <label>Upstream URL (optional)</label>
      <input type="url" value={upstreamUrl} onChange={(event) => setUpstreamUrl(event.target.value)} />

      <button type="submit" disabled={busy}>
        {busy ? "Applying..." : "Apply Prefab"}
      </button>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </form>
  );
}
