import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
});

export const createProjectPromptTokenSchema = z.object({
  password: z.string().min(1).max(200),
});
