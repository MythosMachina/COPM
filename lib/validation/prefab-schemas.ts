import { z } from "zod";

export const adminProjectPrefabSchema = z.object({
  type: z.enum(["DOMNEX_PROVISION", "DOMNEX_TEARDOWN", "GITHUB_RELEASE"]),
  repoUrl: z.string().url().optional(),
  fqdn: z.string().min(3).max(253).optional(),
  upstreamUrl: z.string().url().optional(),
  executionOrder: z.number().int().min(1).max(9999).optional(),
});
