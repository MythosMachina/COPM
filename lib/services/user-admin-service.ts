import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export type AdminUserItemDTO = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  projectLimit: number;
  projectCount: number;
  allowedDomains: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersSnapshotDTO = {
  users: AdminUserItemDTO[];
  managedDomains: string[];
};

type CreateManagedUserInput = {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
  projectLimit?: number;
  allowedDomains?: string[];
};

type UpdateManagedUserInput = {
  projectLimit?: number;
  allowedDomains?: string[];
};

function normalizeDomains(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export async function listManagedUsers(): Promise<AdminUsersSnapshotDTO> {
  const [users, managedDomainsRaw] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { projects: true },
        },
        domainAccess: {
          select: { domain: true },
          orderBy: { domain: "asc" },
        },
      },
    }),
    prisma.domNexApexDomain.findMany({
      select: { domain: true },
      orderBy: { domain: "asc" },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      projectLimit: user.projectLimit,
      projectCount: user._count.projects,
      allowedDomains: user.domainAccess.map((entry) => entry.domain),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
    managedDomains: managedDomainsRaw.map((entry) => entry.domain),
  };
}

export async function createManagedUser(input: CreateManagedUserInput): Promise<AdminUserItemDTO> {
  const role = input.role ?? "USER";
  const projectLimit = role === "ADMIN" ? 9999 : Math.max(1, input.projectLimit ?? 2);
  const allowedDomains = normalizeDomains(input.allowedDomains);
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash,
          role,
          projectLimit,
        },
      });

      if (role !== "ADMIN" && allowedDomains.length > 0) {
        await tx.userDomNexDomainAccess.createMany({
          data: allowedDomains.map((domain) => ({
            userId: user.id,
            domain,
          })),
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          _count: { select: { projects: true } },
          domainAccess: { select: { domain: true }, orderBy: { domain: "asc" } },
        },
      });
    });

    if (!created) {
      throw new ValidationError("Unable to load created user");
    }

    return {
      id: created.id,
      username: created.username,
      email: created.email,
      role: created.role,
      projectLimit: created.projectLimit,
      projectCount: created._count.projects,
      allowedDomains: created.domainAccess.map((entry) => entry.domain),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Username or email already exists");
    }
    throw error;
  }
}

export async function updateManagedUser(userId: string, input: UpdateManagedUserInput): Promise<AdminUserItemDTO> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { projects: true } } },
  });
  if (!existing) {
    throw new NotFoundError("User not found");
  }

  const nextLimit =
    input.projectLimit === undefined
      ? existing.projectLimit
      : existing.role === "ADMIN"
        ? existing.projectLimit
        : Math.max(1, input.projectLimit);
  const allowedDomains = normalizeDomains(input.allowedDomains);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        projectLimit: nextLimit,
      },
    });

    if (input.allowedDomains !== undefined) {
      await tx.userDomNexDomainAccess.deleteMany({ where: { userId } });
      if (existing.role !== "ADMIN" && allowedDomains.length > 0) {
        await tx.userDomNexDomainAccess.createMany({
          data: allowedDomains.map((domain) => ({
            userId,
            domain,
          })),
        });
      }
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: {
        _count: { select: { projects: true } },
        domainAccess: { select: { domain: true }, orderBy: { domain: "asc" } },
      },
    });
  });

  if (!updated) {
    throw new NotFoundError("User not found");
  }

  return {
    id: updated.id,
    username: updated.username,
    email: updated.email,
    role: updated.role,
    projectLimit: updated.projectLimit,
    projectCount: updated._count.projects,
    allowedDomains: updated.domainAccess.map((entry) => entry.domain),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}
