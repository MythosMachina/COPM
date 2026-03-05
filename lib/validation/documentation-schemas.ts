import { z } from "zod";

export const createDocumentationSchema = z.object({
  name: z.string().min(2).max(160),
  content: z.string().min(1).max(50000),
});

export const updateDocumentationSchema = z.object({
  content: z.string().min(1).max(50000),
});
