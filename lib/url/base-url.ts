import { headers as nextHeaders } from "next/headers";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getBaseUrlFromRequest(request: Request): string {
  return normalizeBaseUrl(new URL(request.url).origin);
}

export function getBaseUrlFromEnv(): string {
  return normalizeBaseUrl(process.env.NEXTAUTH_URL ?? "http://localhost:3300");
}

export async function getBaseUrlFromServerHeaders(): Promise<string> {
  const headers = await nextHeaders();
  const forwardedProto = headers.get("x-forwarded-proto");
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ?? headers.get("host");

  if (host) {
    const protocol = forwardedProto ?? "http";
    return normalizeBaseUrl(`${protocol}://${host}`);
  }

  return getBaseUrlFromEnv();
}

export function toAbsoluteUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}
