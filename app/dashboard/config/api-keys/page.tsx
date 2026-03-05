import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ApiKeyManager } from "@/app/dashboard/api-keys/api-key-manager";
import { authOptions } from "@/lib/auth/options";

export default async function ConfigApiKeysPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/config");
  }

  return <ApiKeyManager />;
}
