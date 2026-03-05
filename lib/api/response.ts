import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api/types";

export function jsonSuccess<T>(data: T, status = 200) {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
  };

  return NextResponse.json(payload, { status });
}

export function jsonError(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
) {
  const payload: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return NextResponse.json(payload, { status });
}
