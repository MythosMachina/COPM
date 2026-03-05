import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AutodevPresetEditor } from "@/components/admin/autodev-preset-editor";
import { authOptions } from "@/lib/auth/options";
import { getOrCreateAutodevSystemPreset } from "@/lib/services/system-preset-service";

export default async function ConfigAutodevPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/config");
  }

  const content = await getOrCreateAutodevSystemPreset();
  return <AutodevPresetEditor initialContent={content} />;
}
