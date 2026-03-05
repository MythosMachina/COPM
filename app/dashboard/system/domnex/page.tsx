import { redirect } from "next/navigation";

export default async function DomNexAdapterPage() {
  redirect("/dashboard/config/domnex");
}
