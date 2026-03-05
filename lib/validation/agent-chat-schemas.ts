import { z } from "zod";

export const createAgentChatAnswerSchema = z.object({
  questionId: z.string().trim().min(3).max(64),
  answer: z.string().trim().min(1).max(20_000),
});
