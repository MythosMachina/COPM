import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { isInitialSetupRequired } from "@/lib/services/user-service";

export default async function RegisterPage() {
  const setupRequired = await isInitialSetupRequired();

  if (!setupRequired) {
    redirect("/login");
  }

  return (
    <main className="auth-page">
      <section className="card">
        <h1>Initial Registration</h1>
        <p>Create the first operator account. The first account receives admin rights automatically.</p>
        <RegisterForm />
      </section>
    </main>
  );
}
