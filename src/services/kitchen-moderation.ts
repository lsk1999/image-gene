import "server-only";
import { ScanAction, ScanSemanticMode } from "@waffo/pancake-ts";
import { z } from "zod";
import { db } from "@/db";
import { kitchenModeration } from "@/db/schema";
import { waffoClient, waffoConfig } from "@/integrations/waffo";
import defaultBlocklist from "@/data/kitchen-content-blocklist.json";
import { moderateKitchenImage } from "@/services/kitchen-replicate-moderation";

export class KitchenModerationError extends Error {}

export function assertKitchenModerationConfigured() {
  if (process.env.PAY_PROVIDER !== "waffo") return;
  waffoConfig();
  if (
    !process.env.WAFFO_MERCHANT_ID ||
    !process.env.WAFFO_PRIVATE_KEY ||
    !process.env.REPLICATE_API_TOKEN?.trim()
  ) {
    throw new Error("Kitchen content safety is not configured.");
  }
}

async function record(id: string, stage: string, result: unknown) {
  // A failed audit write also prevents generation/delivery; never silently skip it.
  await db()
    .insert(kitchenModeration)
    .values({ id: `${id}:${stage}`, generation_id: id, stage, result });
}

export async function screenKitchenPrompt(id: string, prompt: string) {
  if (process.env.PAY_PROVIDER !== "waffo") return;
  assertKitchenModerationConfigured();
  const blocklist = z
    .object({
      version: z.string().min(1),
      categories: z.record(z.array(z.string().min(2).max(120)).max(2000)),
    })
    .parse(
      process.env.CONTENT_SAFETY_BLOCKLIST
        ? JSON.parse(process.env.CONTENT_SAFETY_BLOCKLIST)
        : defaultBlocklist,
    );
  const normalized = prompt.normalize("NFKC").toLowerCase();
  const matchedCategories = Object.entries(blocklist.categories)
    .filter(([, terms]) =>
      terms.some((term) => {
        const value = term.normalize("NFKC").toLowerCase();
        // Whole words avoid matching 'porn' inside an unrelated English word.
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return /^[\x00-\x7F]+$/.test(value)
          ? new RegExp(`\\b${escaped}\\b`, "i").test(normalized)
          : normalized.includes(value);
      }),
    )
    .map(([category]) => category);
  const client = waffoClient();
  const verdicts = [];
  // Prompt Sift accepts 10,000 characters per request. Never truncate user input.
  for (let offset = 0; offset < prompt.length; offset += 8000) {
    const verdict = await client.contentSafety.scanPrompt({
      prompt: prompt.slice(offset, offset + 9000),
      semantic: ScanSemanticMode.Enforce,
    });
    if (!verdict.requestId)
      throw new Error("Missing content safety request ID.");
    verdicts.push(verdict);
    if (verdict.action !== ScanAction.Allow) break;
  }
  await record(id, "prompt", {
    requestId: verdicts[0]?.requestId,
    verdicts,
    blocklistVersion: blocklist.version,
    matchedCategories,
  });
  if (
    !verdicts.length ||
    matchedCategories.length ||
    verdicts.some((verdict) => verdict.action !== ScanAction.Allow)
  ) {
    throw new KitchenModerationError(
      "This request could not pass our content safety checks. Please use a kitchen photo and kitchen design instructions.",
    );
  }
}

export async function screenKitchenImage(
  id: string,
  bytes: Uint8Array,
  mime: string,
  stage: "source_image" | "output_image",
  timeoutMs?: number,
) {
  if (process.env.PAY_PROVIDER !== "waffo") return;
  assertKitchenModerationConfigured();
  const verdict = await moderateKitchenImage(bytes, mime, timeoutMs);
  await record(id, stage, verdict);
  if (verdict.status === "error") {
    throw new Error(
      `Image safety check unavailable (${verdict.reason}). Please try again later.`,
    );
  }
  if (verdict.status === "blocked") {
    throw new KitchenModerationError(
      stage === "source_image"
        ? "This photo could not pass our content safety checks. Please upload a kitchen photo without people or sensitive content."
        : "This result could not pass our content safety checks and was not saved. Your design credit will be released.",
    );
  }
}
