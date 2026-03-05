import { CopmAgentWorker } from "@/lib/orchestrator/worker";

async function main() {
  const worker = new CopmAgentWorker();
  await worker.runLoop();
}

main().catch((error) => {
  console.error("[COPM-AGENT] Fatal error", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
