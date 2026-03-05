import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/admin/projects/[id]/agent-chat/route";

const { getAgentChatByProjectMock, answerAgentQuestionMock } = vi.hoisted(() => ({
  getAgentChatByProjectMock: vi.fn().mockResolvedValue({
    entries: [],
    openQuestionCount: 1,
    latestOpenQuestionId: "q01",
  }),
  answerAgentQuestionMock: vi.fn().mockResolvedValue({
    questionId: "q01",
    documentationId: "d1",
  }),
}));

vi.mock("@/lib/auth/session-auth", () => ({
  requireOperatorSession: vi.fn().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }),
}));

vi.mock("@/lib/services/agent-chat-service", () => ({
  getAgentChatByProject: getAgentChatByProjectMock,
  answerAgentQuestion: answerAgentQuestionMock,
}));

describe("/api/v1/admin/projects/:id/agent-chat route", () => {
  it("GET returns chat payload", async () => {
    const response = await GET(new Request("http://localhost/api/v1/admin/projects/p1/agent-chat"), {
      params: { id: "p1" },
    });
    expect(response.status).toBe(200);
  });

  it("POST submits answer and returns updated chat", async () => {
    const request = new Request("http://localhost/api/v1/admin/projects/p1/agent-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: "q01", answer: "Use local postgres." }),
    });

    const response = await POST(request, { params: { id: "p1" } });
    expect(response.status).toBe(201);
    expect(answerAgentQuestionMock).toHaveBeenCalled();
  });
});
