import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(3).max(180),
  executionOrder: z.number().int().min(1).max(9999).optional(),
  istState: z.string().min(3).max(4000),
  sollState: z.string().min(3).max(4000),
  technicalPlan: z.string().min(3).max(4000),
  riskImpact: z.string().min(3).max(4000),
  requiresOperatorFeedback: z.boolean().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  executionOrder: z.number().int().min(1).max(9999).optional(),
  status: z.enum(["ACTIVE", "DONE"]).optional(),
  istState: z.string().min(3).max(4000).optional(),
  sollState: z.string().min(3).max(4000).optional(),
  technicalPlan: z.string().min(3).max(4000).optional(),
  riskImpact: z.string().min(3).max(4000).optional(),
  requiresOperatorFeedback: z.boolean().optional(),
});
