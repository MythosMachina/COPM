"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskDTO } from "@/types/domain";

type TaskFormProps = {
  mode: "create" | "edit";
  projectId: string;
  task?: TaskDTO;
  backHref: string;
  initialExecutionOrder?: number;
};

type TaskDraft = {
  title: string;
  executionOrder: number;
  status: "ACTIVE" | "DONE";
  requiresOperatorFeedback: boolean;
  istState: string;
  sollState: string;
  technicalPlan: string;
  riskImpact: string;
};

function toDraft(task?: TaskDTO): TaskDraft {
  return {
    title: task?.title ?? "",
    executionOrder: task?.executionOrder ?? 1,
    status: task?.status ?? "ACTIVE",
    requiresOperatorFeedback: task?.requiresOperatorFeedback ?? false,
    istState: task?.istState ?? "",
    sollState: task?.sollState ?? "",
    technicalPlan: task?.technicalPlan ?? "",
    riskImpact: task?.riskImpact ?? "",
  };
}

type PrefabType = "DOMNEX_PROVISION" | "DOMNEX_TEARDOWN" | "GITHUB_RELEASE";

export function TaskForm({ mode, projectId, task, backHref, initialExecutionOrder = 1 }: TaskFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<TaskDraft>(() => {
    const value = toDraft(task);
    if (mode === "create" && !task) {
      value.executionOrder = initialExecutionOrder;
    }
    return value;
  });
  const [createMode, setCreateMode] = useState<"CUSTOM" | "PREFAB">("CUSTOM");
  const [prefabType, setPrefabType] = useState<PrefabType>("DOMNEX_PROVISION");
  const [prefabRepoUrl, setPrefabRepoUrl] = useState("");
  const [prefabFqdn, setPrefabFqdn] = useState("");
  const [prefabUpstreamUrl, setPrefabUpstreamUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    let response: Response;
    if (mode === "create" && createMode === "PREFAB") {
      if (prefabType === "GITHUB_RELEASE" && !prefabRepoUrl.trim()) {
        setError("Repo URL is required for GitHub prefab.");
        setBusy(false);
        return;
      }

      const prefabPayload: {
        type: PrefabType;
        executionOrder: number;
        repoUrl?: string;
        fqdn?: string;
        upstreamUrl?: string;
      } = {
        type: prefabType,
        executionOrder: draft.executionOrder,
      };

      if (prefabType === "GITHUB_RELEASE") {
        prefabPayload.repoUrl = prefabRepoUrl.trim();
      }

      if (prefabType === "DOMNEX_PROVISION") {
        if (prefabFqdn.trim()) {
          prefabPayload.fqdn = prefabFqdn.trim();
        }
        if (prefabUpstreamUrl.trim()) {
          prefabPayload.upstreamUrl = prefabUpstreamUrl.trim();
        }
      }

      response = await fetch(`/api/v1/admin/projects/${projectId}/prefabs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefabPayload),
      });
    } else {
      const url =
        mode === "create"
          ? `/api/v1/admin/projects/${projectId}/tasks`
          : `/api/v1/admin/tasks/${task?.id ?? ""}`;

      const method = mode === "create" ? "POST" : "PATCH";
      response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
    }

    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message ?? "Unable to save task");
      setBusy(false);
      return;
    }

    setBusy(false);
    router.push(backHref);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card bootstrap-form">
      <h2>{mode === "create" ? "Add Task" : `Edit Task ${task?.visualId ?? ""}`}</h2>
      {mode === "create" ? (
        <>
          <label>Creation Type</label>
          <select value={createMode} onChange={(event) => setCreateMode(event.target.value === "PREFAB" ? "PREFAB" : "CUSTOM")}>
            <option value="CUSTOM">Custom Task</option>
            <option value="PREFAB">Prefab Task</option>
          </select>
        </>
      ) : null}

      {mode === "create" && createMode === "PREFAB" ? (
        <>
          <label>Prefab Type</label>
          <select value={prefabType} onChange={(event) => setPrefabType(event.target.value as PrefabType)}>
            <option value="DOMNEX_PROVISION">DomNex Provisioning</option>
            <option value="DOMNEX_TEARDOWN">DomNex Teardown</option>
            <option value="GITHUB_RELEASE">GitHub Push/Release</option>
          </select>

          {prefabType === "GITHUB_RELEASE" ? (
            <>
              <label>Repo URL (required)</label>
              <input
                type="url"
                value={prefabRepoUrl}
                onChange={(event) => setPrefabRepoUrl(event.target.value)}
                required
              />
            </>
          ) : null}

          {prefabType === "DOMNEX_PROVISION" ? (
            <>
              <label>FQDN (optional override)</label>
              <input type="text" value={prefabFqdn} onChange={(event) => setPrefabFqdn(event.target.value)} />

              <label>Upstream URL (optional)</label>
              <input
                type="url"
                value={prefabUpstreamUrl}
                onChange={(event) => setPrefabUpstreamUrl(event.target.value)}
              />
            </>
          ) : null}

          {prefabType === "DOMNEX_TEARDOWN" ? (
            <p className="label">No extra input required for teardown prefab.</p>
          ) : null}
        </>
      ) : null}

      <label>Title</label>
      <input
        value={draft.title}
        onChange={(event) => setDraft((c) => ({ ...c, title: event.target.value }))}
        required={!(mode === "create" && createMode === "PREFAB")}
        disabled={mode === "create" && createMode === "PREFAB"}
      />

      <label>Execution Order</label>
      <input
        type="number"
        min={1}
        max={9999}
        value={draft.executionOrder}
        onChange={(event) =>
          setDraft((c) => ({ ...c, executionOrder: Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1) }))
        }
        required
      />

      {mode === "create" && createMode === "PREFAB" ? null : (
        <>
          <label>Status</label>
          <select
            value={draft.status}
            onChange={(event) => setDraft((c) => ({ ...c, status: event.target.value === "DONE" ? "DONE" : "ACTIVE" }))}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DONE">DONE</option>
          </select>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.requiresOperatorFeedback}
              onChange={(event) => setDraft((c) => ({ ...c, requiresOperatorFeedback: event.target.checked }))}
            />
            Operator Gate: before run completion, require operator feedback (QA question)
          </label>

          <label>IST</label>
          <textarea rows={3} value={draft.istState} onChange={(event) => setDraft((c) => ({ ...c, istState: event.target.value }))} required />

          <label>SOLL</label>
          <textarea rows={3} value={draft.sollState} onChange={(event) => setDraft((c) => ({ ...c, sollState: event.target.value }))} required />

          <label>Technical Plan</label>
          <textarea
            rows={3}
            value={draft.technicalPlan}
            onChange={(event) => setDraft((c) => ({ ...c, technicalPlan: event.target.value }))}
            required
          />

          <label>Risk Impact</label>
          <textarea rows={3} value={draft.riskImpact} onChange={(event) => setDraft((c) => ({ ...c, riskImpact: event.target.value }))} required />
        </>
      )}

      <div className="task-admin-actions">
        <button type="submit" disabled={busy}>
          {busy
            ? "Saving..."
            : mode === "create"
              ? createMode === "PREFAB"
                ? "Create Prefab Task"
                : "Create Task"
              : "Save Task"}
        </button>
        <button type="button" className="signout" onClick={() => router.push(backHref)} disabled={busy}>
          Cancel
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
