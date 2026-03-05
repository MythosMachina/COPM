"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AgentLiveStreamModalProps = {
  runId: string | null;
  disabled?: boolean;
};

export function AgentLiveStreamModal({ runId, disabled }: AgentLiveStreamModalProps) {
  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [statusText, setStatusText] = useState("IDLE");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [failureReason, setFailureReason] = useState<string>("");
  const logRef = useRef<HTMLPreElement | null>(null);

  const canOpen = Boolean(runId) && !disabled;

  useEffect(() => {
    if (!open || !runId) {
      return;
    }

    const source = new EventSource(`/api/v1/admin/agent/runs/${runId}/stream`);

    source.addEventListener("init", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        status?: string;
        updatedAt?: string;
        failureReason?: string | null;
        tail?: string;
      };
      setStatusText(payload.status ?? "UNKNOWN");
      setUpdatedAt(payload.updatedAt ?? "");
      setFailureReason(payload.failureReason ?? "");
      setLogText(payload.tail ?? "");
    });

    source.addEventListener("chunk", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { text?: string };
      const chunk = payload.text ?? "";
      if (!chunk) return;
      setLogText((current) => {
        const next = `${current}${chunk}`;
        const lines = next.split(/\r?\n/);
        return lines.slice(-400).join("\n");
      });
    });

    source.addEventListener("state", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        status?: string;
        updatedAt?: string;
        failureReason?: string | null;
      };
      if (payload.status) setStatusText(payload.status);
      if (payload.updatedAt) setUpdatedAt(payload.updatedAt);
      setFailureReason(payload.failureReason ?? "");
    });

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [open, runId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const element = logRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [logText, open]);

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "n/a";
    return new Date(updatedAt).toLocaleString("de-DE");
  }, [updatedAt]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={!canOpen}>
        Open Live Stream
      </button>
      {open ? (
        <div className="stream-modal-backdrop" role="dialog" aria-modal="true" aria-label="Agent live stream">
          <div className="stream-modal">
            <div className="stream-modal-head">
              <h3>Agent Live Stream</h3>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="ops-muted">Run: {runId ?? "n/a"}</p>
            <div className="ops-badge-row">
              <span className="status-pill active">{statusText}</span>
              <span className="visual-id-pill">Updated: {updatedLabel}</span>
            </div>
            {failureReason ? <p className="error">{failureReason}</p> : null}
            <pre ref={logRef} className="stream-modal-log">{logText || "(waiting for stream output...)"}</pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
