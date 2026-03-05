import type { ProjectDocumentation } from "@/lib/orchestrator/types";

const QUESTION_NAME_PREFIX = "QA:QUESTION:";
const ANSWER_NAME_PREFIX = "QA:ANSWER:";
const WORKSPACE_CONSISTENCY_RE = /(unexpected\s+changes?\s+were\s+detected\s+in\s+the\s+working\s+directory|workspace\s+consistency)/i;

export type ParsedQuestionDoc = {
  docId: string;
  questionId: string;
  runId: string;
  status: "OPEN" | "RESOLVED";
  content: string;
  createdAt: string;
};

export type ParsedAnswerDoc = {
  docId: string;
  questionId: string;
  runId: string;
  content: string;
  createdAt: string;
};

export type AgentChatEntry = {
  questionId: string;
  runId: string;
  status: "OPEN" | "RESOLVED";
  question: string;
  questionCreatedAt: string;
  answer: string | null;
  answerCreatedAt: string | null;
};

function parseMeta(content: string): Record<string, string> {
  const lines = content.replace(/\r/g, "").split("\n");
  if (lines[0]?.trim() !== "---") {
    return {};
  }

  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (end === -1) {
    return {};
  }

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      meta[key] = value;
    }
  }

  return meta;
}

function extractBody(content: string): string {
  const lines = content.replace(/\r/g, "").split("\n");
  if (lines[0]?.trim() !== "---") {
    return content.trim();
  }

  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (end === -1) {
    return content.trim();
  }

  return lines.slice(end + 1).join("\n").trim();
}

export function parseQuestions(docs: ProjectDocumentation[]): ParsedQuestionDoc[] {
  return docs
    .filter((doc) => doc.name.startsWith(QUESTION_NAME_PREFIX))
    .map((doc) => {
      const meta = parseMeta(doc.content);
      return {
        docId: doc.id,
        questionId: meta.questionId ?? doc.name.replace(QUESTION_NAME_PREFIX, "").trim(),
        runId: meta.runId ?? "unknown",
        status: meta.status === "RESOLVED" ? "RESOLVED" : "OPEN",
        content: extractBody(doc.content),
        createdAt: doc.createdAt,
      } as ParsedQuestionDoc;
    });
}

export function parseAnswers(docs: ProjectDocumentation[]): ParsedAnswerDoc[] {
  return docs
    .filter((doc) => doc.name.startsWith(ANSWER_NAME_PREFIX))
    .map((doc) => {
      const meta = parseMeta(doc.content);
      return {
        docId: doc.id,
        questionId: meta.questionId ?? doc.name.replace(ANSWER_NAME_PREFIX, "").trim(),
        runId: meta.runId ?? "unknown",
        content: extractBody(doc.content),
        createdAt: doc.createdAt,
      } as ParsedAnswerDoc;
    });
}

export function listOpenQuestions(docs: ProjectDocumentation[]) {
  const questions = parseQuestions(docs);
  const answers = parseAnswers(docs);
  const answeredIds = new Set(answers.map((answer) => answer.questionId));

  return questions.filter((question) => question.status === "OPEN" && !answeredIds.has(question.questionId));
}

export function buildAgentChatTimeline(docs: ProjectDocumentation[]): {
  entries: AgentChatEntry[];
  openQuestionCount: number;
  latestOpenQuestionId: string | null;
} {
  const questions = parseQuestions(docs).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const answers = parseAnswers(docs);
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  const entries = questions.map((question) => {
    const answer = answerByQuestionId.get(question.questionId);
    return {
      questionId: question.questionId,
      runId: question.runId,
      status: answer ? "RESOLVED" : question.status,
      question: question.content,
      questionCreatedAt: question.createdAt,
      answer: answer?.content ?? null,
      answerCreatedAt: answer?.createdAt ?? null,
    } satisfies AgentChatEntry;
  });

  const openEntries = entries.filter((entry) => entry.status === "OPEN" && !entry.answer);

  return {
    entries,
    openQuestionCount: openEntries.length,
    latestOpenQuestionId: openEntries.length > 0 ? openEntries[openEntries.length - 1].questionId : null,
  };
}

export function formatQuestionDoc(input: {
  questionId: string;
  runId: string;
  question: string;
}): { name: string; content: string } {
  return {
    name: `${QUESTION_NAME_PREFIX}${input.questionId}`,
    content: [
      "---",
      "kind: QUESTION",
      "status: OPEN",
      `questionId: ${input.questionId}`,
      `runId: ${input.runId}`,
      "source: COPM_AGENT",
      "---",
      "",
      input.question.trim(),
    ].join("\n"),
  };
}

export function formatResumeContext(
  docs: ProjectDocumentation[],
  options?: {
    maxPairs?: number;
    maxQuestionChars?: number;
    maxAnswerChars?: number;
  },
): string {
  const maxPairs = options?.maxPairs ?? 3;
  const maxQuestionChars = options?.maxQuestionChars ?? 500;
  const maxAnswerChars = options?.maxAnswerChars ?? 700;
  const questions = parseQuestions(docs);
  const answers = parseAnswers(docs);
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  const pairs = questions
    .map((question) => ({
      question,
      answer: answerByQuestionId.get(question.questionId),
    }))
    .filter(
      (pair) =>
        pair.answer &&
        !WORKSPACE_CONSISTENCY_RE.test(pair.question.content) &&
        !WORKSPACE_CONSISTENCY_RE.test(pair.answer.content),
    )
    .sort((a, b) => Date.parse(a.question.createdAt) - Date.parse(b.question.createdAt));

  if (pairs.length === 0 || maxPairs <= 0) {
    return "";
  }

  const compactPairs = pairs.slice(-maxPairs);
  const clip = (value: string, limit: number) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) {
      return normalized;
    }

    return `${normalized.slice(0, limit - 1)}…`;
  };

  return [
    "",
    "## COPM Question/Answer Context",
    ...compactPairs.flatMap((pair, index) => [
      `### QA ${index + 1}`,
      `Question (${pair.question.questionId}): ${clip(pair.question.content, maxQuestionChars)}`,
      `Answer: ${clip(pair.answer?.content ?? "", maxAnswerChars)}`,
      "",
    ]),
  ].join("\n").trim();
}
