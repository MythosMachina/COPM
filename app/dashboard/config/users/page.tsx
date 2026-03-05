import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { authOptions } from "@/lib/auth/options";

export default async function ConfigUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/config");
  }

  return <UserManagementPanel />;
}
