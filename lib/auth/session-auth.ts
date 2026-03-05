import { getServerSession } from "next-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";
import { authOptions } from "@/lib/auth/options";

export async function requireOperatorSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError("Operator session required");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireOperatorSession();

  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError("Admin privileges required");
  }

  return session;
}
