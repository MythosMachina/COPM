import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserGitHubConfigEditor } from "@/components/admin/user-github-config-editor";
import { authOptions } from "@/lib/auth/options";
import { getUserGitHubConfig } from "@/lib/services/github-adapter-service";

export default async function ConfigMyGitHubPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const config = await getUserGitHubConfig(session.user.id);

  return <UserGitHubConfigEditor initialConfig={config} />;
}
