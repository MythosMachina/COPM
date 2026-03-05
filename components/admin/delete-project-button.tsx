"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteProjectButtonProps = {
  projectId: string;
  label?: string;
};

export function DeleteProjectButton({ projectId, label = "Delete Project" }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const ok = window.confirm("Delete this project including tasks and documentation?");
    if (!ok) {
      return;
    }

    setBusy(true);
    setError("");

    const response = await fetch(`/api/v1/admin/projects/${projectId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "Unable to delete project");
      setBusy(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="danger" disabled={busy} onClick={onDelete}>
        {busy ? "Deleting..." : label}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
