import { ForbiddenError } from "@/lib/api/errors";
import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { buildApiHelpData } from "@/lib/services/api-help-service";
import { getBaseUrlFromRequest } from "@/lib/url/base-url";

function isPrivateOrLoopbackIp(value: string): boolean {
  const ip = value.trim().toLowerCase();
  if (!ip) return false;
  if (ip === "localhost" || ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("fd") || ip.startsWith("fc")) return true;
  const match172 = /^172\.(\d{1,3})\./.exec(ip);
  if (match172) {
    const octet = Number.parseInt(match172[1] ?? "", 10);
    if (Number.isFinite(octet) && octet >= 16 && octet <= 31) {
      return true;
    }
  }
  return false;
}

function firstIpFromHeader(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
}

function isInternalApiHelpRequest(request: Request): boolean {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.split(":")[0]?.trim() ?? "";
  const hostHeader = request.headers.get("host")?.split(":")[0]?.trim() ?? "";
  const hostname = new URL(request.url).hostname;
  const effectiveHost = forwardedHost || hostHeader || hostname;

  const forwardedFor = firstIpFromHeader(request.headers.get("x-forwarded-for"));
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const cfIp = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  const candidates = [forwardedFor, realIp, cfIp].filter(Boolean);

  const hostLooksInternal = effectiveHost ? isPrivateOrLoopbackIp(effectiveHost) : false;
  const hasForwardedExternalHost = Boolean(forwardedHost) && !isPrivateOrLoopbackIp(forwardedHost);

  if (hasForwardedExternalHost) {
    if (candidates.length === 0) {
      return false;
    }
    return candidates.some((candidate) => isPrivateOrLoopbackIp(candidate));
  }

  if (hostLooksInternal) {
    return true;
  }

  if (candidates.length > 0) {
    return candidates.some((candidate) => isPrivateOrLoopbackIp(candidate));
  }
  return false;
}

export const GET = withErrorHandling(async (request: Request) => {
  if (!isInternalApiHelpRequest(request)) {
    throw new ForbiddenError("API help is restricted to internal network access");
  }
  return jsonSuccess(buildApiHelpData(getBaseUrlFromRequest(request)));
});
