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
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#0a1120", color: "#e5edf8" }}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
