import { z } from "zod";

export const updateDomNexAdapterSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url(),
  defaultDomain: z.string().min(3).max(253).optional().nullable(),
  apexDomains: z.array(z.string().min(3).max(253)).optional(),
  apiToken: z.string().min(8).max(512).optional(),
  clearApiToken: z.boolean().optional(),
});
