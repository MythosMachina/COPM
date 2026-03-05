import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getProjectById } from "@/lib/services/project-service";

export default async function EditTaskPage({
  params,
}: {
  params: { id: string; taskId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect(`/dashboard/projects/${params.id}`);
  }

  const project = await getProjectById(params.id);

  return (
    <main className="dashboard project-dashboard">
      <header className="ops-header">
        <div>
          <h1>Task System Replaced</h1>
          <p>{project.name}</p>
        </div>
        <Link href={`/dashboard/projects/${project.id}/lifecycle`} className="inline-action">Open lifecycle engine</Link>
      </header>
      <div className="ops-shell ops-shell--focus">
        <section className="card">
          <p>Task editing is disabled in vNext. Manage modules via lifecycle runs instead.</p>
        </section>
      </div>
    </main>
  );
}
