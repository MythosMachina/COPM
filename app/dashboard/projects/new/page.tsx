import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ProjectBootstrapForm } from "@/components/admin/project-bootstrap-form";
import { authOptions } from "@/lib/auth/options";

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main className="dashboard project-dashboard">
      <header className="ops-header">
        <div>
          <h1>Create Lifecycle Project</h1>
          <p>Project + run bootstrap.</p>
        </div>
        <Link href="/dashboard" className="inline-action">Back to dashboard</Link>
      </header>

      <div className="ops-shell ops-shell--config">
        <aside className="card ops-nav">
          <h2>Admin Nav</h2>
          <div className="ops-nav-group">
            <h3>Pages</h3>
            <ul className="ops-nav-list">
              <li><Link href="/dashboard">Dashboard</Link></li>
              <li><Link href="/dashboard/projects/new">Create project</Link></li>
              <li><Link href="/dashboard/config">Central config</Link></li>
            </ul>
          </div>
        </aside>

        <section className="ops-main">
          <ProjectBootstrapForm />
        </section>
      </div>
    </main>
  );
}
