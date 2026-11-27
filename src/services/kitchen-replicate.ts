import "server-only";
import { z } from "zod";

const predictionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  status: z.enum(["starting", "processing", "succeeded", "failed", "canceled", "aborted"]),
  output: z.unknown().optional(),
});
const API = "https://api.replicate.com/v1";
// Outside Workers, keep a narrow fallback because Node fetch can reach private networks.
const SIGNED_OUTPUT_HOST = "ai-gateway-outputs.0d37909e38d3e99c29fa2cd343ac421a.r2.cloudflarestorage.com";
const SIGNED_OUTPUT_PREFIX = "/provider-outputs/";
const DNS_HOSTNAME = /^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/i;
const OUTPUT_LIMIT = 30 * 1024 * 1024;
const DEFAULT_MODEL = "google/nano-banana-2.1";
const KONTEXT_MODELS = [
  "black-forest-labs/flux-kontext-pro",
  "black-forest-labs/flux-kontext-max",
];

export class KitchenReplicateError extends Error {
  constructor(
    readonly stage: string,
    readonly predictionId: string | undefined,
    readonly elapsedMs: number,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Unknown Replicate error", { cause });
    this.name = "KitchenReplicateError";
  }
}

function predictionInput(model: string, prompt: string, sourceUrl: string, promptUpsampling?: boolean) {
  const common = {
    prompt,
    aspect_ratio: "match_input_image",
    output_format: "png",
  };

  if (model === DEFAULT_MODEL) {
    return {
      ...common,
      image_input: [sourceUrl],
      resolution: "1K",
      google_search: false,
      image_search: false,
    };
  }

  return {
    ...common,
    input_image: sourceUrl,
    safety_tolerance: 2,
    prompt_upsampling: promptUpsampling,
  };
}

function parsePrediction(value: unknown) {
  const parsed = predictionSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid Replicate prediction response.");
  return parsed.data;
}

export function kitchenModelName() {
  const model = process.env.KITCHEN_REPLICATE_MODEL?.trim() || DEFAULT_MODEL;
  if (model !== DEFAULT_MODEL && !KONTEXT_MODELS.includes(model)) {
    throw new Error("Unsupported kitchen Replicate model.");
  }
  return model;
}

export function kitchenReplicate() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Replicate API token is not configured.");
  const model = kitchenModelName();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  return {
    model: `replicate/${model}`,
    async generate(
      prompt: string,
      sourceUrl: string,
      { timeoutSeconds = 240, promptUpsampling }: {
        timeoutSeconds?: number;
        promptUpsampling?: boolean;
      } = {},
    ) {
      const signal = AbortSignal.timeout(timeoutSeconds * 1000);
      const startedAt = Date.now();
      let stage = "create_prediction";
      let predictionId: string | undefined;
      let succeeded = false;
      try {
        // Never automatically retry creation: the first request may already be billed.
        const created = await fetch(`${API}/models/${model}/predictions`, {
          method: "POST", headers: { ...headers, Prefer: "wait=60", "Cancel-After": `${timeoutSeconds}s` }, signal, redirect: "manual",
          body: JSON.stringify({
            input: predictionInput(model, prompt, sourceUrl, promptUpsampling),
          }),
        });
        if (!created.ok) throw new Error(`Replicate creation failed (${created.status}).`);
        stage = "read_creation_response";
        const creation = await created.json();
        const createdId = predictionSchema.pick({ id: true }).safeParse(creation);
        if (createdId.success) predictionId = createdId.data.id;
        let prediction = parsePrediction(creation);
        predictionId = prediction.id;
        while (prediction.status === "starting" || prediction.status === "processing") {
          stage = "poll_prediction";
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => { clearTimeout(timer); reject(new Error("Replicate generation timed out.")); };
            const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 1500);
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          });
          const response = await fetch(`${API}/predictions/${predictionId}`, { headers, signal, cache: "no-store", redirect: "manual" });
          if (!response.ok) throw new Error(`Replicate status failed (${response.status}).`);
          prediction = parsePrediction(await response.json());
          if (prediction.id !== predictionId) throw new Error("Replicate prediction ID mismatch.");
        }
        stage = "validate_prediction_output";
        if (prediction.status !== "succeeded") throw new Error(`Replicate prediction ${prediction.status}.`);
        succeeded = true;
        const output = typeof prediction.output === "string" ? prediction.output : Array.isArray(prediction.output) ? prediction.output[0] : null;
        if (typeof output !== "string") throw new Error("Replicate returned no image.");
        let url: URL;
        try {
          url = new URL(output);
        } catch {
          throw new Error("Replicate returned a malformed image URL.");
        }
        if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
          throw new Error("Replicate returned an unsupported image URL.");
        }
        const isDeliveryHost = url.hostname === "replicate.delivery" || url.hostname.endsWith(".replicate.delivery");
        // wrangler.toml enables global_fetch_strictly_public for these external downloads.
        const hasPublicEgress = globalThis.navigator?.userAgent === "Cloudflare-Workers";
        const isKnownSignedOutput = url.hostname === SIGNED_OUTPUT_HOST
          && url.pathname.startsWith(SIGNED_OUTPUT_PREFIX)
          && url.pathname.length > SIGNED_OUTPUT_PREFIX.length
          && url.searchParams.get("X-Amz-Algorithm") === "AWS4-HMAC-SHA256"
          && /^[0-9a-f]{64}$/i.test(url.searchParams.get("X-Amz-Signature") ?? "");
        if (!DNS_HOSTNAME.test(url.hostname) || (!hasPublicEgress && !isDeliveryHost && !isKnownSignedOutput)) {
          throw new Error(`Replicate returned an unsupported image URL (host: ${url.hostname}).`);
        }

        // Only Replicate's delivery hosts receive its token. Other hosts use their returned URL as-is.
        stage = "download_result_headers";
        const image = await fetch(url, {
          headers: isDeliveryHost ? { Authorization: `Bearer ${token}` } : undefined,
          signal,
          redirect: "manual",
        });
        if (!image.ok || !image.body) {
          await image.body?.cancel().catch(() => undefined);
          throw new Error(`Replicate image download failed (${image.status}).`);
        }
        if (Number(image.headers.get("content-length")) > OUTPUT_LIMIT) {
          await image.body.cancel().catch(() => undefined);
          throw new Error("Generated image is too large.");
        }
        stage = "download_result_body";
        const reader = image.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > OUTPUT_LIMIT) throw new Error("Generated image is too large.");
            chunks.push(value);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        const result = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
        return result;
      } catch (error) {
        throw new KitchenReplicateError(stage, predictionId, Date.now() - startedAt, error);
      } finally {
        if (predictionId && !succeeded) {
          await fetch(`${API}/predictions/${predictionId}/cancel`, {
            method: "POST", headers, signal: AbortSignal.timeout(5000), redirect: "manual",
          }).then(async response => { await response.body?.cancel(); }).catch(() => undefined);
        }
      }
    },
  };
}
