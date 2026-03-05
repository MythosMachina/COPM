import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DomNexAdapterEditor } from "@/components/admin/domnex-adapter-editor";
import { authOptions } from "@/lib/auth/options";
import { getDomNexAdapterConfig } from "@/lib/services/domnex-adapter-service";

export default async function ConfigDomnexPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/config");
  }

  const config = await getDomNexAdapterConfig();
  return <DomNexAdapterEditor initialConfig={config} />;
}
