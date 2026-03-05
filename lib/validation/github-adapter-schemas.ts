import { z } from "zod";

export const updateGitHubAdapterSchema = z.object({
  enabled: z.boolean(),
  apiToken: z.string().min(1).optional(),
  clearApiToken: z.boolean().optional(),
  username: z.string().min(1).max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
});
