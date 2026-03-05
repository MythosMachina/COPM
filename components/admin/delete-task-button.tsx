"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { softRefreshPreserveScroll } from "@/lib/client/soft-refresh";

type DeleteTaskButtonProps = {
  taskId: string;
};

export function DeleteTaskButton({ taskId }: DeleteTaskButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const ok = window.confirm("Delete this task?");
    if (!ok) {
      return;
    }

    setBusy(true);
    setError("");

    const response = await fetch(`/api/v1/admin/tasks/${taskId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message ?? "Unable to delete task");
      setBusy(false);
      return;
    }

    setBusy(false);
    softRefreshPreserveScroll(router);
  }

  return (
    <div>
      <button type="button" className="danger" onClick={() => void onDelete()} disabled={busy}>
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
