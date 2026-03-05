"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";

type AgentChatEntry = {
  questionId: string;
  runId: string;
  status: "OPEN" | "RESOLVED";
  question: string;
  questionCreatedAt: string;
  answer: string | null;
  answerCreatedAt: string | null;
};

type AgentChatPayload = {
  entries: AgentChatEntry[];
  openQuestionCount: number;
  latestOpenQuestionId: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

type AgentQuestionChatProps = {
  projectId: string;
  initialPayload: AgentChatPayload;
};

export function AgentQuestionChat({ projectId, initialPayload }: AgentQuestionChatProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [payload, setPayload] = useState<AgentChatPayload>(initialPayload);

  const openEntries = useMemo(
    () => payload.entries.filter((entry) => entry.status === "OPEN" && !entry.answer),
    [payload.entries],
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(initialPayload.latestOpenQuestionId);

  useEffect(() => {
    setPayload(initialPayload);
    setSelectedQuestionId((current) => {
      if (current && initialPayload.entries.some((entry) => entry.questionId === current && !entry.answer)) {
        return current;
      }
      return initialPayload.latestOpenQuestionId;
    });
  }, [initialPayload]);

  useEffect(() => {
    if (!selectedQuestionId || !openEntries.some((entry) => entry.questionId === selectedQuestionId)) {
      setSelectedQuestionId(openEntries.length > 0 ? openEntries[openEntries.length - 1].questionId : null);
    }
  }, [openEntries, selectedQuestionId]);

  const refreshChat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/agent-chat`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse<AgentChatPayload>;
      if (!response.ok || !data.success || !data.data) {
        setError(data.error?.message ?? "Unable to load agent chat");
        return;
      }
      setPayload(data.data);
    } catch {
      setError("Unable to load agent chat");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshChat();
    }, 10_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [panelOpen, refreshChat]);

  async function onSubmit() {
    if (!selectedQuestionId) {
      setError("No open question selected");
      return;
    }

    const answer = draft.trim();
    if (!answer) {
      setError("Antwort darf nicht leer sein.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/projects/${projectId}/agent-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: selectedQuestionId,
          answer,
        }),
      });
      const data = (await response.json()) as ApiResponse<{ chat?: AgentChatPayload }>;
      if (!response.ok || !data.success) {
        setError(data.error?.message ?? "Unable to send answer");
        return;
      }
      setDraft("");
      if (data.data?.chat) {
        setPayload(data.data.chat);
      } else {
        await refreshChat();
      }
    } catch {
      setError("Unable to send answer");
    } finally {
      setSubmitting(false);
    }
  }

  if (payload.openQuestionCount <= 0) {
    return null;
  }

  return (
    <div className="agent-chat-wrapper">
      <button
        type="button"
        className="agent-chat-open-button"
        onClick={() => setPanelOpen((current) => !current)}
      >
        {panelOpen ? "Hide Agent Question Chat" : `Open Agent Question Chat (${payload.openQuestionCount})`}
      </button>

      {panelOpen ? (
        <div className="agent-chat-panel">
          <div className="agent-chat-toolbar">
            <strong>Async Agent Chat</strong>
            <button type="button" className="signout" onClick={() => void refreshChat()} disabled={loading || submitting}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="agent-chat-thread">
            {payload.entries.map((entry) => (
              <div key={entry.questionId} className="agent-chat-row">
                <article className="agent-chat-bubble question">
                  <p className="agent-chat-meta">
                    Agent • {entry.questionId} • {new Date(entry.questionCreatedAt).toLocaleString("de-DE")}
                  </p>
                  <MarkdownContent content={entry.question} />
                </article>

                {entry.answer ? (
                  <article className="agent-chat-bubble answer">
                    <p className="agent-chat-meta">
                      Operator • {new Date(entry.answerCreatedAt ?? entry.questionCreatedAt).toLocaleString("de-DE")}
                    </p>
                    <MarkdownContent content={entry.answer} />
                  </article>
                ) : null}
              </div>
            ))}
          </div>

          <div className="agent-chat-reply">
            {openEntries.length > 1 ? (
              <label>
                Open question
                <select
                  value={selectedQuestionId ?? ""}
                  onChange={(event) => setSelectedQuestionId(event.target.value || null)}
                  disabled={submitting}
                >
                  {openEntries.map((entry) => (
                    <option key={entry.questionId} value={entry.questionId}>
                      {entry.questionId}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Operator answer
              <textarea
                rows={4}
                placeholder="Antwort an den Agenten..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={submitting}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="button" onClick={() => void onSubmit()} disabled={submitting || !selectedQuestionId}>
              {submitting ? "Sending..." : "Send answer"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
