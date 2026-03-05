import { redirect } from "next/navigation";

export default async function ApiKeysPage() {
  redirect("/dashboard/config/api-keys");
}
