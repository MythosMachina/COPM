import { describe, expect, it } from "vitest";
import { formatQuestionDoc, formatResumeContext, listOpenQuestions } from "@/lib/orchestrator/question-bridge";

describe("question-bridge", () => {
  it("detects open questions", () => {
    const question = formatQuestionDoc({
      questionId: "q1",
      runId: "r1",
      question: "Need database version?",
    });

    const docs = [
      {
        id: "d1",
        projectId: "p1",
        name: question.name,
        content: question.content,
        version: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    expect(listOpenQuestions(docs)).toHaveLength(1);
  });

  it("builds resume context from resolved qa pairs", () => {
    const docs = [
      {
        id: "d1",
        projectId: "p1",
        name: "QA:QUESTION:q1",
        content: "---\nkind: QUESTION\nstatus: OPEN\nquestionId: q1\nrunId: r1\n---\nWhat stack?",
        version: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "d2",
        projectId: "p1",
        name: "QA:ANSWER:q1",
        content: "---\nkind: ANSWER\nquestionId: q1\nrunId: r1\n---\nUse Next.js.",
        version: 1,
        createdAt: "2026-03-01T00:01:00.000Z",
      },
    ];

    const context = formatResumeContext(docs);
    expect(context).toContain("Question (q1): What stack?");
    expect(context).toContain("Answer: Use Next.js.");
  });
});
