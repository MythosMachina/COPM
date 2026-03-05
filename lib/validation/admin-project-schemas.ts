import { z } from "zod";

const lifecycleModuleSchema = z.object({
  moduleOrder: z.number().int().min(1).max(9999),
  moduleType: z.enum(["TECHSTACK", "FEATURE", "CHECK", "DOMAIN", "DEPLOY", "CHANGE", "FIX", "ITERATE", "TEARDOWN", "CUSTOM"]),
  title: z.string().min(2).max(200),
  description: z.string().min(2).max(5000),
  expectedState: z.string().min(2).max(5000),
  config: z.unknown().optional(),
  gateRequired: z.boolean().optional(),
  completionPolicy: z.enum(["PAUSE_ALWAYS", "PAUSE_ON_RISK", "CONTINUE_AUTOMATIC"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

const bootstrapLifecycleSchema = z.object({
  title: z.string().min(3).max(200).default("Initial Lifecycle Run"),
  mode: z.enum(["STEP", "BATCH"]).default("STEP"),
  classification: z.enum(["BIRTH", "CHANGE", "FIX", "ITERATE", "TEARDOWN"]).default("BIRTH"),
  autoStart: z.boolean().default(true),
  modules: z.array(lifecycleModuleSchema).min(1),
});

const bootstrapDocumentationSchema = z.object({
  name: z.string().min(2).max(160),
  content: z.string().min(1).max(50000),
});

export const adminBootstrapProjectSchema = z.object({
  name: z.string().min(2).max(120),
  target: z.string().min(10).max(4000),
  autoProvisionDomain: z.boolean().optional(),
  lifecycle: bootstrapLifecycleSchema,
  documentation: z.array(bootstrapDocumentationSchema).default([]),
});
