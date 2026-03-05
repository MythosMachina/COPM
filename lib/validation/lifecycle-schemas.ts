import { z } from "zod";

const lifecycleModuleTypeSchema = z.enum([
  "TECHSTACK",
  "FEATURE",
  "CHECK",
  "DOMAIN",
  "DEPLOY",
  "CHANGE",
  "FIX",
  "ITERATE",
  "TEARDOWN",
  "CUSTOM",
]);

const lifecycleModuleStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "BLOCKED", "SKIPPED"]);

const moduleCompletionPolicySchema = z.enum(["PAUSE_ALWAYS", "PAUSE_ON_RISK", "CONTINUE_AUTOMATIC"]);

const lifecycleRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createLifecycleRunSchema = z.object({
  title: z.string().min(3).max(200),
  mode: z.enum(["STEP", "BATCH"]).optional(),
  classification: z.enum(["BIRTH", "CHANGE", "FIX", "ITERATE", "TEARDOWN", "DEPLOYED"]).optional(),
  autoStart: z.boolean().optional(),
  modules: z
    .array(
      z.object({
        moduleOrder: z.number().int().min(1).max(9999),
        moduleType: lifecycleModuleTypeSchema,
        title: z.string().min(2).max(200),
        description: z.string().min(2),
        config: z.unknown().optional(),
        expectedState: z.string().min(2),
        gateRequired: z.boolean().optional(),
        completionPolicy: moduleCompletionPolicySchema.optional(),
        riskLevel: lifecycleRiskLevelSchema.optional(),
      }),
    )
    .min(1),
});

export const lifecycleRunResumeSchema = z.object({
  reason: z.string().min(2).max(500).optional(),
});

export const updateLifecycleModuleSchema = z.object({
  status: lifecycleModuleStatusSchema,
  actualState: z.string().optional(),
  lastError: z.string().optional(),
  evidence: z
    .object({
      kind: z.string().min(2).max(100),
      summary: z.string().min(2).max(1000),
      details: z.unknown().optional(),
    })
    .optional(),
});

export const upsertLifecycleModulePrephaseReviewSchema = z.object({
  content: z.string().min(5),
});

export const appendLifecycleModuleSchema = z.object({
  moduleType: z.enum(["CHANGE", "FIX", "TEARDOWN"]),
  title: z.string().min(2).max(200),
  description: z.string().min(2),
  riskLevel: lifecycleRiskLevelSchema.optional(),
});

export const updateLifecycleModuleDefinitionSchema = z
  .object({
    moduleType: lifecycleModuleTypeSchema.optional(),
    title: z.string().min(2).max(200).optional(),
    description: z.string().min(2).optional(),
    expectedState: z.string().min(2).optional(),
    gateRequired: z.boolean().optional(),
    riskLevel: lifecycleRiskLevelSchema.optional(),
    config: z.unknown().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable module field must be provided",
  });

export type CreateLifecycleRunInput = z.infer<typeof createLifecycleRunSchema>;
export type ResumeLifecycleRunInput = z.infer<typeof lifecycleRunResumeSchema>;
export type UpdateLifecycleModuleInput = z.infer<typeof updateLifecycleModuleSchema>;
export type UpsertLifecycleModulePrephaseReviewInput = z.infer<typeof upsertLifecycleModulePrephaseReviewSchema>;
export type UpdateLifecycleModuleDefinitionInput = z.infer<typeof updateLifecycleModuleDefinitionSchema>;
export type AppendLifecycleModuleInput = z.infer<typeof appendLifecycleModuleSchema>;
