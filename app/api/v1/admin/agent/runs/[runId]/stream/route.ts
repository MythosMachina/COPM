import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function readTail(pathname: string, lineCount: number): Promise<{ text: string; size: number }> {
  const content = await fs.readFile(pathname, "utf8");
  const lines = content.split(/\r?\n/);
  const tail = lines.slice(-lineCount).join("\n");
  return { text: tail, size: Buffer.byteLength(content, "utf8") };
}

export const GET = withErrorHandling(async (request: Request, { params }: { params: { runId: string } }) => {
  await requireAdminSession();

  const run = await prisma.agentRun.findUnique({
    where: { id: params.runId },
    select: {
      id: true,
      status: true,
      workspacePath: true,
      promptPath: true,
      updatedAt: true,
      failureReason: true,
      projectId: true,
    },
  });

  if (!run) {
    return new Response("run not found", { status: 404 });
  }

  const promptDir = path.dirname(run.promptPath);
  const streamPathPrimary = `${promptDir}/agent-run-${run.id}.log`;
  const streamPathLegacyA = `${run.workspacePath}/.copm/agent-run-${run.id}.log`;
  const streamPathLegacyB = `${run.workspacePath}/agent-run-${run.id}.log`;
  let streamPath = streamPathPrimary;
  try {
    await fs.stat(streamPathPrimary);
  } catch {
    try {
      await fs.stat(streamPathLegacyA);
      streamPath = streamPathLegacyA;
    } catch {
      streamPath = streamPathLegacyB;
    }
  }
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let cursor = 0;

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        const tail = await readTail(streamPath, 100);
        cursor = tail.size;
        controller.enqueue(
          encoder.encode(
            sseEncode("init", {
              runId: run.id,
              status: run.status,
              updatedAt: run.updatedAt.toISOString(),
              failureReason: run.failureReason,
              tail: tail.text,
            }),
          ),
        );
      } catch {
        controller.enqueue(
          encoder.encode(
            sseEncode("init", {
              runId: run.id,
              status: run.status,
              updatedAt: run.updatedAt.toISOString(),
              failureReason: run.failureReason,
              tail: "(no stream file yet)",
            }),
          ),
        );
      }

      const timer = setInterval(async () => {
        if (closed) {
          return;
        }
        try {
          const [freshRun, stat] = await Promise.all([
            prisma.agentRun.findUnique({
              where: { id: run.id },
              select: { status: true, updatedAt: true, failureReason: true },
            }),
            fs.stat(streamPath),
          ]);

          if (stat.size > cursor) {
            const handle = await fs.open(streamPath, "r");
            const length = stat.size - cursor;
            const buffer = Buffer.alloc(length);
            await handle.read(buffer, 0, length, cursor);
            await handle.close();
            cursor = stat.size;
            const chunk = buffer.toString("utf8");
            controller.enqueue(encoder.encode(sseEncode("chunk", { text: chunk })));
          }

          if (!freshRun) {
            controller.enqueue(encoder.encode(sseEncode("state", { status: "UNKNOWN" })));
            clearInterval(timer);
            close();
            return;
          }

          controller.enqueue(
            encoder.encode(
              sseEncode("state", {
                status: freshRun.status,
                updatedAt: freshRun.updatedAt.toISOString(),
                failureReason: freshRun.failureReason,
              }),
            ),
          );

          if (["DONE", "FAILED", "CANCELED", "WAITING_INPUT"].includes(freshRun.status)) {
            clearInterval(timer);
            close();
          }
        } catch {
          // keep stream alive on transient read errors
        }
      }, 1000);

      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
});
