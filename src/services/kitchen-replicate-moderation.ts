import "server-only";
import { z } from "zod";

export const KITCHEN_IMAGE_MODERATION_MODEL = "lucataco/flux-content-filter";
// Pin the schema/behavior verified against Replicate, rather than silently following latest.
export const KITCHEN_IMAGE_MODERATION_VERSION =
  "6cde73479afa6189b52903fd968d3b5abadccc514a87b97dfc9ec43179d9f0d3";
const NSFW_THRESHOLD = 0.5;
const API = "https://api.replicate.com/v1";
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
// Files API IDs include a filename extension (unlike prediction IDs).
const fileIdentifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.=-]{0,199}$/);
const predictionSchema = z.object({
  id: identifier,
  version: z.literal(KITCHEN_IMAGE_MODERATION_VERSION),
  status: z.enum([
    "starting",
    "processing",
    "succeeded",
    "failed",
    "canceled",
    "aborted",
  ]),
  output: z.unknown().optional(),
});
const verdictSchema = z.object({
  image_flagged: z.boolean(),
  text_flagged: z.boolean(),
  overall_flagged: z.boolean(),
  nsfw_detected: z.boolean(),
  copyright_concerns: z.boolean(),
  public_figures: z.boolean(),
  details: z
    .object({ nsfw_score: z.number().finite().min(0).max(1) })
    .passthrough(),
});

export type KitchenImageModerationReport = {
  model: string;
  version: string;
  threshold: number;
  predictionId?: string;
  status: "allowed" | "blocked" | "error";
  reason?: string;
  nsfwScore?: number;
  flags?: Omit<z.infer<typeof verdictSchema>, "details">;
};

class ModerationServiceError extends Error {}

async function jsonResponse(response: Response, operation: string) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ModerationServiceError(`${operation}_http_${response.status}`);
  }
  return response.json();
}

async function pause(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

export async function moderateKitchenImage(
  bytes: Uint8Array,
  mime: string,
  timeoutMs = 90_000,
): Promise<KitchenImageModerationReport> {
  const report: KitchenImageModerationReport = {
    model: KITCHEN_IMAGE_MODERATION_MODEL,
    version: KITCHEN_IMAGE_MODERATION_VERSION,
    threshold: NSFW_THRESHOLD,
    status: "error",
  };
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error("Replicate API token is not configured.");
  if (
    !bytes.byteLength ||
    bytes.byteLength > 30 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(mime)
  ) {
    return { ...report, reason: "invalid_image" };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    return { ...report, reason: "deadline_exceeded" };
  }
  const durationMs = Math.min(90_000, Math.floor(timeoutMs));
  const signal = AbortSignal.timeout(durationMs);
  const headers = { Authorization: `Bearer ${token}` };
  let fileId: string | undefined;
  let terminal = false;
  let operation = "prepare_image";
  try {
    let image: string;
    if (bytes.byteLength < 1024 * 1024) {
      image = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    } else {
      // Replicate recommends data URIs only below 1 MB. Larger photos use its Files API.
      // No unreviewed image is written to the site's result storage or made public.
      operation = "upload_image";
      const form = new FormData();
      form.append(
        "content",
        new Blob([new Uint8Array(bytes).buffer], { type: mime }),
        `moderation.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`,
      );
      const uploaded = await jsonResponse(
        await fetch(`${API}/files`, {
          method: "POST",
          headers,
          body: form,
          signal,
          redirect: "error",
          cache: "no-store",
        }),
        operation,
      );
      const uploadedId = z.object({ id: fileIdentifier }).safeParse(uploaded);
      if (uploadedId.success) fileId = uploadedId.data.id;
      const parsed = z
        .object({
          id: fileIdentifier,
          urls: z.object({ get: z.string().url() }),
        })
        .parse(uploaded);
      fileId = parsed.id;
      const url = new URL(parsed.urls.get);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.hash ||
        !(
          url.hostname === "api.replicate.com" ||
          url.hostname === "replicate.delivery" ||
          url.hostname.endsWith(".replicate.delivery")
        )
      ) {
        throw new ModerationServiceError("invalid_file_url");
      }
      image = url.toString();
    }
    operation = "create_prediction";
    // Do not retry a POST: the provider may already have created and billed the first request.
    const created = await jsonResponse(
      await fetch(`${API}/predictions`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "wait=5",
          "Cancel-After": `${Math.ceil(durationMs / 1000)}s`,
        },
        body: JSON.stringify({
          version: KITCHEN_IMAGE_MODERATION_VERSION,
          input: { image, nsfw_threshold: NSFW_THRESHOLD },
        }),
        signal,
        redirect: "error",
        cache: "no-store",
      }),
      operation,
    );
    // Retain a valid ID for cancellation even if the remaining response is malformed.
    const createdId = z.object({ id: identifier }).safeParse(created);
    if (createdId.success) report.predictionId = createdId.data.id;
    let prediction = predictionSchema.parse(created);
    while (
      prediction.status === "starting" ||
      prediction.status === "processing"
    ) {
      operation = "poll_prediction";
      await pause(signal);
      prediction = predictionSchema.parse(
        await jsonResponse(
          await fetch(`${API}/predictions/${report.predictionId}`, {
            headers,
            signal,
            redirect: "error",
            cache: "no-store",
          }),
          operation,
        ),
      );
      if (prediction.id !== report.predictionId)
        throw new ModerationServiceError("prediction_id_mismatch");
    }
    terminal = true;
    if (prediction.status !== "succeeded")
      throw new ModerationServiceError(`prediction_${prediction.status}`);
    operation = "validate_verdict";
    // This model catches internal image errors and can return all flags=false.
    // Require a real score and reject ANY reported error; flags alone are insufficient.
    const verdict = verdictSchema.parse(prediction.output);
    if (Object.keys(verdict.details).some((key) => key.endsWith("_error"))) {
      throw new ModerationServiceError("incomplete_verdict");
    }
    const { details, ...flags } = verdict;
    report.flags = flags;
    report.nsfwScore = details.nsfw_score;
    report.status =
      Object.values(flags).some(Boolean) || details.nsfw_score >= NSFW_THRESHOLD
        ? "blocked"
        : "allowed";
    return report;
  } catch (error) {
    // Never persist provider logs/errors containing image data, signed URLs, or prompts.
    report.reason =
      error instanceof ModerationServiceError
        ? error.message
        : signal.aborted
          ? "deadline_exceeded"
          : `${operation}_failed`;
    return report;
  } finally {
    if (report.predictionId && !terminal) {
      try {
        const canceled = await fetch(
          `${API}/predictions/${report.predictionId}/cancel`,
          {
            method: "POST",
            headers,
            redirect: "error",
            signal: AbortSignal.timeout(3000),
          },
        );
        await canceled.body?.cancel();
        if (!canceled.ok)
          console.warn("Kitchen moderation cancellation failed", {
            predictionId: report.predictionId,
            status: canceled.status,
          });
      } catch {
        console.warn("Kitchen moderation cancellation unavailable", {
          predictionId: report.predictionId,
        });
      }
    }
    if (fileId) {
      // Best effort cleanup; Replicate also applies its own input-file expiration.
      try {
        const deleted = await fetch(`${API}/files/${fileId}`, {
          method: "DELETE",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(3000),
        });
        await deleted.body?.cancel();
        if (!deleted.ok && deleted.status !== 404)
          console.warn("Kitchen moderation file cleanup failed", {
            status: deleted.status,
          });
      } catch {
        console.warn("Kitchen moderation file cleanup unavailable");
      }
    }
  }
}
