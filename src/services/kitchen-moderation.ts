import "server-only";
import { ScanAction, ScanSemanticMode } from "@waffo/pancake-ts";
import { db } from "@/db";
import { kitchenModeration } from "@/db/schema";
import { waffoClient, waffoConfig } from "@/integrations/waffo";

export class KitchenModerationError extends Error {}

export class KitchenModerationServiceError extends Error {
  constructor(readonly reason: string) {
    super(
      "Prompt safety checking is temporarily unavailable. Please try again shortly.",
    );
  }
}

export function assertKitchenModerationConfigured() {
  if (process.env.PAY_PROVIDER !== "waffo") return;
  waffoConfig();
  if (
    !process.env.WAFFO_MERCHANT_ID?.trim() ||
    !process.env.WAFFO_PRIVATE_KEY?.trim()
  ) {
    throw new KitchenModerationServiceError("prompt_configuration_missing");
  }
}

async function record(id: string, result: unknown) {
  try {
    await db()
      .insert(kitchenModeration)
      .values({
        id: id + ":prompt",
        generation_id: id,
        stage: "prompt",
        result,
      });
  } catch {
    console.error("Could not save prompt moderation audit", { runId: id });
    throw new KitchenModerationServiceError("audit_write_failed");
  }
}

export async function screenKitchenPrompt(id: string, prompt: string) {
  if (process.env.PAY_PROVIDER !== "waffo") return;
  assertKitchenModerationConfigured();
  const verdicts = [];
  // Waffo accepts at most 10,000 characters. Overlap chunks without truncating input.
  for (let offset = 0; offset < prompt.length; offset += 8000) {
    let verdict;
    try {
      verdict = await waffoClient().contentSafety.scanPrompt({
        prompt: prompt.slice(offset, offset + 9000),
        semantic: ScanSemanticMode.Enforce,
      });
      if (
        !verdict.requestId ||
        !Object.values(ScanAction).includes(verdict.action)
      ) {
        throw new Error("Invalid content safety response.");
      }
    } catch {
      await record(id, {
        status: "error",
        reason: "prompt_service_unavailable",
        verdicts,
      });
      throw new KitchenModerationServiceError("prompt_service_unavailable");
    }
    verdicts.push(verdict);
    if (verdict.action !== ScanAction.Allow) break;
  }
  await record(id, { requestId: verdicts[0]?.requestId, verdicts });
  if (
    !verdicts.length ||
    verdicts.some((verdict) => verdict.action !== ScanAction.Allow)
  ) {
    throw new KitchenModerationError(
      verdicts.some((verdict) => verdict.action === ScanAction.Review)
        ? "Your design instructions require a safety review, so generation has not started. Please revise them or contact support."
        : "Your design instructions did not pass the safety check. Please revise your instructions and custom choices to describe a kitchen design.",
    );
  }
}
