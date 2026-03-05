"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { softRefreshPreserveScroll } from "@/lib/client/soft-refresh";

type DeleteDocumentationButtonProps = {
  documentationId: string;
  redirectTo?: string;
  label?: string;
};

export function DeleteDocumentationButton({ documentationId, redirectTo, label = "Delete" }: DeleteDocumentationButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    const ok = window.confirm("Delete this documentation entry?");
    if (!ok) {
      return;
    }

    setBusy(true);
    setError("");

    const response = await fetch(`/api/v1/admin/documentation/${documentationId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "Unable to delete documentation");
      setBusy(false);
      return;
    }

    setBusy(false);
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    softRefreshPreserveScroll(router);
  }

  return (
    <div>
      <button type="button" className="danger" disabled={busy} onClick={() => void onDelete()}>
        {busy ? "Deleting..." : label}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
