import { redirect } from "next/navigation";

export default async function ConfigGitHubGlobalPage() {
  redirect("/dashboard/config/my-github");
}
