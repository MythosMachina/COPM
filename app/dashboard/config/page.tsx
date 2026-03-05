import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth/options";

export default async function ConfigPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <section className="card">
      <h2>Config Overview</h2>
      <div className="detail-grid">
        <article className="detail-box">
          <h3>Personal</h3>
          <Link className="inline-action" href="/dashboard/config/my-github">Open My GitHub</Link>
        </article>
        {session.user.role === "ADMIN" ? (
          <>
            <article className="detail-box">
              <h3>User Management</h3>
              <Link className="inline-action" href="/dashboard/config/users">Open Users</Link>
            </article>
            <article className="detail-box">
              <h3>API Keys</h3>
              <Link className="inline-action" href="/dashboard/config/api-keys">Open API Keys</Link>
            </article>
            <article className="detail-box">
              <h3>DomNex Adapter</h3>
              <Link className="inline-action" href="/dashboard/config/domnex">Open DomNex</Link>
            </article>
            <article className="detail-box">
              <h3>Autodev Preset</h3>
              <Link className="inline-action" href="/dashboard/config/autodev">Open Autodev</Link>
            </article>
          </>
        ) : null}
      </div>
    </section>
  );
}
