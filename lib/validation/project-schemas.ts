import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  target: z.string().min(10).max(4000),
  autoProvisionDomain: z.boolean().optional(),
  provisionUpstreamUrl: z.string().url().optional().nullable(),
  provisionInsecureTls: z.boolean().optional(),
  provisionHaEnabled: z.boolean().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  target: z.string().min(10).max(4000).optional(),
  autoProvisionDomain: z.boolean().optional(),
  provisionUpstreamUrl: z.string().url().optional().nullable(),
  provisionInsecureTls: z.boolean().optional(),
  provisionHaEnabled: z.boolean().optional(),
});
