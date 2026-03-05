import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { isInitialSetupRequired } from "@/lib/services/user-service";

export default async function LoginPage() {
  const setupRequired = await isInitialSetupRequired();

  return (
    <main className="auth-page">
      <section className="card">
        <h1>Operator Login</h1>
        <p>Authenticate with your operator account to access COPM workspaces.</p>
        <LoginForm />

        {setupRequired ? (
          <p>
            No account yet? <Link href="/register">Run initial registration</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
