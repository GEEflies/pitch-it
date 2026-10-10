import { ExerciseServiceError, MAX_AUDIO_BYTES, submitAttempt } from "@/lib/exercises/service";
import { apiError, apiOk, handleRouteError, isUuid, rateLimited, requireApiUser } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { exerciseAttemptSchema } from "@/lib/validation/schemas";

export const maxDuration = 90;

const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"]);

/** Pokus v cvičení: text (JSON) alebo nahrávka (multipart, neukladá sa). */
export async function POST(request: Request, { params }: RouteContext<"/api/exercises/[exerciseId]/attempts">) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { exerciseId } = await params;
  if (!isUuid(exerciseId)) return apiError(404, "not_found", "Cvičenie neexistuje.");
  const limited = rateLimited(user.id, "attempt", RATE_LIMITS.exerciseAttempt);
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) return apiError(413, "too_large", "Nahrávka je príliš dlhá.");

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof Blob)) return apiError(400, "invalid_request", "Chýba nahrávka.");
      const baseType = audio.type.split(";")[0];
      if (!AUDIO_TYPES.has(baseType)) return apiError(415, "unsupported", "Nepodporovaný formát nahrávky.");
      const duration = Number(form.get("durationMs"));
      const speech = Number(form.get("speechMs"));
      const extension = baseType === "audio/mp4" || baseType === "audio/x-m4a" ? "m4a" : baseType.split("/")[1];
      const attempt = await submitAttempt(user.id, exerciseId, {
        kind: "voice",
        audio,
        fileName: `odpoved.${extension}`,
        durationMs: Number.isFinite(duration) && duration > 0 ? Math.min(duration, 30 * 60 * 1000) : null,
        speechMs: Number.isFinite(speech) && speech > 0 ? Math.min(speech, 30 * 60 * 1000) : null,
      });
      return apiOk({ attempt }, 201);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "invalid_json", "Neplatné telo požiadavky.");
    }
    const parsed = exerciseAttemptSchema.safeParse(body);
    if (!parsed.success || parsed.data.inputMethod !== "text") return apiError(400, "invalid_request", "Odpoveď je prázdna alebo príliš dlhá.");
    const attempt = await submitAttempt(user.id, exerciseId, {
      kind: "text",
      answer: parsed.data.answer,
      durationMs: parsed.data.durationMs,
    });
    return apiOk({ attempt }, 201);
  } catch (error) {
    if (error instanceof ExerciseServiceError) return apiError(error.status, error.code, error.message);
    return handleRouteError(error, "exercises.attempt");
  }
}
