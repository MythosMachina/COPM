import { redirect } from "next/navigation";

export default async function GitHubAdapterPage() {
  redirect("/dashboard/config/my-github");
}
