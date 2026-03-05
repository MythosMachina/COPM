import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { buildAgentChatTimeline } from "@/lib/orchestrator/question-bridge";
import { listLatestDocumentationByProject, createDocumentation } from "@/lib/services/documentation-service";

export async function getAgentChatByProject(projectId: string) {
  const docs = await listLatestDocumentationByProject(projectId);
  return buildAgentChatTimeline(docs);
}

export async function answerAgentQuestion(input: {
  projectId: string;
  questionId: string;
  answer: string;
  source?: string;
}) {
  const chat = await getAgentChatByProject(input.projectId);
  const entry = chat.entries.find((item) => item.questionId === input.questionId);

  if (!entry) {
    throw new NotFoundError("Agent question not found");
  }

  if (entry.answer) {
    throw new ValidationError("Agent question already answered");
  }

  const answer = input.answer.trim();
  if (!answer) {
    throw new ValidationError("Answer cannot be empty");
  }

  const doc = await createDocumentation(input.projectId, {
    name: `QA:ANSWER:${input.questionId}`,
    content: [
      "---",
      "kind: ANSWER",
      `questionId: ${input.questionId}`,
      `runId: ${entry.runId}`,
      `source: ${input.source ?? "COPM_OPERATOR"}`,
      "---",
      "",
      answer,
    ].join("\n"),
  });

  return {
    questionId: input.questionId,
    documentationId: doc.id,
  };
}
