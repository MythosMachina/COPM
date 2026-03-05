import { z } from "zod";

export const createManagedUserSchema = z.object({
  username: z.string().trim().min(3).max(60),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(120),
  role: z.enum(["USER", "ADMIN"]).optional(),
  projectLimit: z.number().int().min(1).max(9999).optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(255)).max(500).optional(),
});

export const updateManagedUserSchema = z.object({
  projectLimit: z.number().int().min(1).max(9999).optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(255)).max(500).optional(),
});

export const updateUserGitHubConfigSchema = z.object({
  enabled: z.boolean(),
  apiToken: z.string().min(1).max(500).optional(),
  clearApiToken: z.boolean().optional(),
  username: z.string().trim().min(1).max(120).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable(),
});
