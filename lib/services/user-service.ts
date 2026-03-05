import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export async function isInitialSetupRequired(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}

type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export async function registerInitialUser(input: RegisterInput) {
  const canRegister = await isInitialSetupRequired();
  if (!canRegister) {
    throw new ForbiddenError("Initial setup is already completed");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.user.create({
      data: {
        username: input.username,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Username or email already exists");
    }

    throw error;
  }
}

export async function verifyUserPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid operator credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid operator credentials");
  }
}

export async function assertUserCanCreateProject(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, projectLimit: true, _count: { select: { projects: true } } },
  });
  if (!user) {
    throw new UnauthorizedError("Invalid operator credentials");
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (user._count.projects >= user.projectLimit) {
    throw new ForbiddenError(
      `Project limit reached (${user.projectLimit}). Increase limit in admin user management before creating more projects.`,
    );
  }
}
