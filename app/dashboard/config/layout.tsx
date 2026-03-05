import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth/options";

export default async function ConfigLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="dashboard project-dashboard">
      <header className="ops-header">
        <div>
          <h1>Config Workspace</h1>
          <p>Centralized configuration.</p>
        </div>
        <Link href="/dashboard" className="inline-action">Back to dashboard</Link>
      </header>

      <div className="ops-shell ops-shell--config">
        <aside className="card ops-nav">
          <h2>Config Nav</h2>
          <div className="ops-nav-group">
            <h3>Personal</h3>
            <ul className="ops-nav-list">
              <li><Link href="/dashboard/config">Overview</Link></li>
              <li><Link href="/dashboard/config/my-github">My GitHub</Link></li>
            </ul>
          </div>
          {session.user.role === "ADMIN" ? (
            <>
              <div className="ops-nav-group">
                <h3>Admin</h3>
                <ul className="ops-nav-list">
                  <li><Link href="/dashboard/config/users">Users</Link></li>
                  <li><Link href="/dashboard/config/api-keys">API Keys</Link></li>
                </ul>
              </div>
              <div className="ops-nav-group">
                <h3>Global</h3>
                <ul className="ops-nav-list">
                  <li><Link href="/dashboard/config/domnex">DomNex Adapter</Link></li>
                  <li><Link href="/dashboard/config/autodev">Autodev Preset</Link></li>
                </ul>
              </div>
            </>
          ) : null}
        </aside>

        <section className="ops-main">{children}</section>
      </div>
    </main>
  );
}
