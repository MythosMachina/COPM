"use client";

import { useState } from "react";

type CopyUrlButtonProps = {
  label: string;
  projectId: string;
  promptTemplate: string;
};

const BEARER_PLACEHOLDER = "__COPM_BEARER_TOKEN__";
const TOKEN_STORAGE_PREFIX = "copm_project_prompt_token_";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

export function CopyUrlButton({ label, projectId, promptTemplate }: CopyUrlButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  function fallbackCopy(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    document.body.removeChild(textarea);
    return ok;
  }

  async function onCopy(forceRegenerateToken = false) {
    const tokenStorageKey = `${TOKEN_STORAGE_PREFIX}${projectId}`;
    let bearerToken = window.localStorage.getItem(tokenStorageKey)?.trim() ?? "";

    if (!bearerToken || forceRegenerateToken) {
      const password = window.prompt("Confirm your operator password to generate a project-bound API token.");
      if (!password?.trim()) {
        setState("failed");
        window.setTimeout(() => {
          setState("idle");
        }, 1400);
        return;
      }

      const response = await fetch(`/api/v1/projects/${projectId}/prompt-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as ApiResponse<{ token: string }>;
      if (!response.ok || !payload.success || !payload.data?.token) {
        setState("failed");
        window.setTimeout(() => {
          setState("idle");
        }, 1400);
        return;
      }

      bearerToken = payload.data.token;
      window.localStorage.setItem(tokenStorageKey, bearerToken);
    }

    const value = promptTemplate.replaceAll(BEARER_PLACEHOLDER, bearerToken);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setState("copied");
      } else {
        const ok = fallbackCopy(value);
        setState(ok ? "copied" : "failed");
      }
    } catch {
      const ok = fallbackCopy(value);
      setState(ok ? "copied" : "failed");
    }

    window.setTimeout(() => {
      setState("idle");
    }, 1400);
  }

  return (
    <button
      type="button"
      className="copy-url-button"
      onClick={(event) => void onCopy(event.altKey || event.shiftKey || event.ctrlKey || event.metaKey)}
      title="Click copies a ready-to-use Codex prompt. Click with Alt/Shift/Ctrl/Meta to rotate project token."
    >
      {state === "copied" ? "Prompt copied" : state === "failed" ? "Generation failed" : `${label} (Click to prompt)`}
    </button>
  );
}
