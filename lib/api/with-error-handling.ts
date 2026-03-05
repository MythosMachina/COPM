import { ZodError } from "zod";
import { AppError, ValidationError } from "@/lib/api/errors";
import { jsonError } from "@/lib/api/response";

export function withErrorHandling<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        const validation = new ValidationError("Invalid request payload", error.flatten());
        return jsonError(validation.code, validation.message, validation.status, validation.details);
      }

      if (error instanceof AppError) {
        return jsonError(error.code, error.message, error.status, error.details);
      }

      const message = error instanceof Error ? error.message : "Unhandled error";
      return jsonError("INTERNAL_ERROR", message, 500);
    }
  };
}
