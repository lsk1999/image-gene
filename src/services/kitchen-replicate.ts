import "server-only";
import { z } from "zod";

const predictionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  status: z.enum(["starting", "processing", "succeeded", "failed", "canceled"]),
  output: z.unknown().optional(),
});
const API = "https://api.replicate.com/v1";
const OUTPUT_LIMIT = 30 * 1024 * 1024;

function parsePrediction(value: unknown) {
  const parsed = predictionSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid Replicate prediction response.");
  return parsed.data;
}

export function kitchenReplicate() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Replicate API token is not configured.");
  const model = process.env.KITCHEN_REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro";
  // These models share the input schema. Other models require their own adapter.
  if (!["black-forest-labs/flux-kontext-pro", "black-forest-labs/flux-kontext-max"].includes(model)) {
    throw new Error("Unsupported kitchen Replicate model.");
  }
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  return {
    model: `replicate/${model}`,
    async generate(prompt: string, sourceUrl: string) {
      const signal = AbortSignal.timeout(240_000);
      let predictionId: string | undefined;
      let succeeded = false;
      try {
        // Never automatically retry creation: the first request may already be billed.
        const created = await fetch(`${API}/models/${model}/predictions`, {
          method: "POST", headers: { ...headers, Prefer: "wait=60", "Cancel-After": "240s" }, signal,
          body: JSON.stringify({ input: { prompt, input_image: sourceUrl, aspect_ratio: "match_input_image", output_format: "png", safety_tolerance: 2 } }),
        });
        if (!created.ok) throw new Error(`Replicate creation failed (${created.status}).`);
        let prediction = parsePrediction(await created.json());
        predictionId = prediction.id;
        while (prediction.status === "starting" || prediction.status === "processing") {
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => { clearTimeout(timer); reject(new Error("Replicate generation timed out.")); };
            const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 1500);
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          });
          const response = await fetch(`${API}/predictions/${predictionId}`, { headers, signal, cache: "no-store" });
          if (!response.ok) throw new Error(`Replicate status failed (${response.status}).`);
          prediction = parsePrediction(await response.json());
        }
        if (prediction.status !== "succeeded") throw new Error(`Replicate prediction ${prediction.status}.`);
        succeeded = true;
        const output = typeof prediction.output === "string" ? prediction.output : Array.isArray(prediction.output) ? prediction.output[0] : null;
        if (typeof output !== "string") throw new Error("Replicate returned no image.");
        const url = new URL(output);
        if (url.protocol !== "https:" || url.username || url.password || url.port || !(url.hostname === "replicate.delivery" || url.hostname.endsWith(".replicate.delivery"))) {
          throw new Error("Replicate returned an unsupported image URL.");
        }
        // Do not forward the API token to redirects or arbitrary output hosts.
        const image = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, redirect: "error" });
        if (!image.ok || !image.body) throw new Error("Replicate image download failed.");
        if (Number(image.headers.get("content-length")) > OUTPUT_LIMIT) throw new Error("Generated image is too large.");
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
      } finally {
        if (predictionId && !succeeded) {
          await fetch(`${API}/predictions/${predictionId}/cancel`, {
            method: "POST", headers, signal: AbortSignal.timeout(5000),
          }).catch(() => undefined);
        }
      }
    },
  };
}
