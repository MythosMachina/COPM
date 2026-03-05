import { redirect } from "next/navigation";
import { isInitialSetupRequired } from "@/lib/services/user-service";

export default async function HomePage() {
  const setupRequired = await isInitialSetupRequired();
  if (setupRequired) {
    redirect("/register");
  }

  redirect("/dashboard");
}
