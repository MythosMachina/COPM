import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import { CopmAgentWorker } from "@/lib/orchestrator/worker";

export const POST = withErrorHandling(async () => {
  await requireAdminSession();
  const worker = new CopmAgentWorker();
  await worker.bootstrap();
  await worker.tick("MANUAL");
  return jsonSuccess({ triggered: true }, 202);
});
