import { z } from "zod";

export const adminProjectDomNexProvisionSchema = z.object({
  fqdn: z.string().min(3).max(253).optional(),
  upstreamUrl: z.string().url(),
  insecureTls: z.boolean().optional(),
  haEnabled: z.boolean().optional(),
  force: z.boolean().optional(),
});

export const adminProjectDomNexToggleSchema = z.object({
  enabled: z.boolean(),
});

export const adminProjectDomNexTeardownSchema = z.object({
  clearFqdn: z.boolean().optional(),
  clearDocumentation: z.boolean().optional(),
  clearWorkspace: z.boolean().optional(),
});
