import { jsonSuccess } from "@/lib/api/response";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { requireAdminSession } from "@/lib/auth/session-auth";
import {
  AUTODEV_PRESET_KEY,
  getSystemPresetByKey,
  upsertSystemPresetByKey,
} from "@/lib/services/system-preset-service";
import { updateSystemPresetSchema } from "@/lib/validation/system-preset-schemas";

export const GET = withErrorHandling(async () => {
  await requireAdminSession();
  const preset = await getSystemPresetByKey(AUTODEV_PRESET_KEY);
  return jsonSuccess(preset);
});

export const PUT = withErrorHandling(async (request: Request) => {
  await requireAdminSession();
  const payload = updateSystemPresetSchema.parse(await request.json());
  const preset = await upsertSystemPresetByKey(AUTODEV_PRESET_KEY, payload.content);
  return jsonSuccess(preset);
});
