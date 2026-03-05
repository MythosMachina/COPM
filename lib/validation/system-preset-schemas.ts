import { z } from "zod";

export const updateSystemPresetSchema = z.object({
  content: z.string().min(20).max(200000),
});
