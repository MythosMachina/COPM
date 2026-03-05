import { UnauthorizedError } from "@/lib/api/errors";
import { verifyApiKeyToken } from "@/lib/services/apikey-service";

export async function assertCodexApiKey(
  request: Request,
  options?: { projectId?: string },
): Promise<{ id: string; projectId: string | null; createdByUserId: string }> {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const token = authorization.replace("Bearer ", "").trim();
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }

  if (process.env.NODE_ENV === "test" && token === process.env.TEST_CODEX_API_KEY) {
    return {
      id: "test-key",
      projectId: options?.projectId ?? null,
      createdByUserId: "test-user",
    };
  }

  const key = await verifyApiKeyToken(token);
  if (!key.projectId) {
    return key;
  }

  if (!options?.projectId || key.projectId !== options.projectId) {
    throw new UnauthorizedError("API key scope does not allow this project");
  }

  return key;
}
