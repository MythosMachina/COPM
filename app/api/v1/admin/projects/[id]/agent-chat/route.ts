import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireOperatorSession } from "@/lib/auth/session-auth";
import { answerAgentQuestion, getAgentChatByProject } from "@/lib/services/agent-chat-service";
import { createAgentChatAnswerSchema } from "@/lib/validation/agent-chat-schemas";

export const GET = withErrorHandling(async (_request: Request, { params }: { params: { id: string } }) => {
  await requireOperatorSession();
  const chat = await getAgentChatByProject(params.id);
  return jsonSuccess(chat);
});

export const POST = withErrorHandling(async (request: Request, { params }: { params: { id: string } }) => {
  const session = await requireOperatorSession();
  const payload = createAgentChatAnswerSchema.parse(await request.json());
  const result = await answerAgentQuestion({
    projectId: params.id,
    questionId: payload.questionId,
    answer: payload.answer,
    source: `COPM_OPERATOR:${session.user.id}`,
  });
  const chat = await getAgentChatByProject(params.id);
  return jsonSuccess({ ...result, chat }, 201);
});
