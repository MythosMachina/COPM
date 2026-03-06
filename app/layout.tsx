import type { Metadata } from "next";
import { SessionProviderWrapper } from "@/components/session-provider";
import { env } from "@/lib/env";
import "./globals.css";

void env;

export const metadata: Metadata = {
  title: "Codex Operator Project Management System",
  description: "Operator control panel for Codex project and task management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const chunkGuardScript = `
(() => {
  if (typeof window === "undefined") return;
  const buildKey = "copm-chunk-reload-once-v1";
  const shouldReloadFromError = (value) => {
    const text = String(value ?? "");
    return text.includes("ChunkLoadError") || text.includes("Loading chunk");
  };
  const tryReload = (reason) => {
    if (!shouldReloadFromError(reason)) return;
    const marker = sessionStorage.getItem(buildKey);
    if (marker === "1") return;
    sessionStorage.setItem(buildKey, "1");
    window.location.reload();
  };
  window.addEventListener("error", (event) => {
    tryReload(event?.error?.message ?? event?.message ?? "");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    tryReload(reason?.message ?? reason);
  });
})();
  `;

  return (
    <html lang="en">
      <body style={{ backgroundColor: "#0a1120", color: "#e5edf8" }}>
        <script dangerouslySetInnerHTML={{ __html: chunkGuardScript }} />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
