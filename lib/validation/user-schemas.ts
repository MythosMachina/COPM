import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(60),
  email: z.string().email().max(200),
  password: z.string().min(8).max(120),
});
