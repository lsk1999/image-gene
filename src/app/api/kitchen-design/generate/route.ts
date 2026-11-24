import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { credits, kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenStorage } from "@/services/kitchen-supabase-storage";
import { KitchenReplicateError, kitchenReplicate } from "@/services/kitchen-replicate";
import { imageMime, kitchenParameters, kitchenPrompt } from "@/services/kitchen-design";
import { CreditsTransType, lockCredits, spendCredits } from "@/services/credit";
import { KITCHEN_DESIGN_CREDIT_COST } from "@/components/kitchen-design/data";

export const maxDuration = 300;
const fail = (message: string, status: number) => Response.json({ code: -1, message }, { status });
const refinement = z.object({
  requestId: z.string().uuid(),
  parentResultId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(1000),
});

function savedResult(id: string, parameters: unknown, isRefinement: boolean) {
  const result = { id, url: `/api/kitchen-design/images/${id}?kind=result` };
  if (!isRefinement) return Response.json({ code: 0, data: result });

  const settings = kitchenParameters.safeParse(parameters);
  return Response.json({
    code: 0,
    data: {
      id,
      results: [result],
      createdAt: new Date().toISOString(),
      originalImage: { name: "Kitchen photo", url: `/api/kitchen-design/images/${id}?kind=source` },
      parameters: settings.success ? settings.data : undefined,
      summary: settings.success ? settings.data.designStyle : "Kitchen design",
    },
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let stage = "prepare_request";
  let stageStartedAt = startedAt;
  const enterStage = (next: string) => {
    stage = next;
    stageStartedAt = Date.now();
  };
  let runId: string | undefined;
  let user = "";
  let ownsRun = false;
  try {
    user = await getUserUuid();
    if (!user) return fail("Sign in to generate and save your kitchen design.", 401);
    const storage = kitchenStorage();
    const provider = kitchenReplicate();
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024) return fail("Photo must be smaller than 10 MB.", 413);
    const isRefinement = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
    let parameters: unknown;
    let sourceKey: string;
    let inputKey: string;
    let upload: { bytes: Uint8Array; mime: string } | undefined;
    let prompt: string;

    if (isRefinement) {
      const edit = refinement.parse(await request.json());
      runId = edit.requestId;
      const [parent] = await db().select().from(kitchenGenerations).where(and(
        eq(kitchenGenerations.uuid, edit.parentResultId),
        eq(kitchenGenerations.user_uuid, user),
        eq(kitchenGenerations.status, "completed"),
      )).limit(1);
      if (!parent?.result_key) return fail("This saved design is unavailable.", 404);

      parameters = parent.parameters;
      sourceKey = parent.source_key;
      inputKey = parent.result_key;
      // The selected result and the user's instruction are the only edit inputs.
      // Saved settings are kept for history and must not steer the edit.
      prompt = edit.instruction;
    } else {
      const form = await request.formData();
      runId = z.string().uuid().parse(form.get("requestId"));
      const settings = kitchenParameters.parse(JSON.parse(String(form.get("parameters"))));
      const photo = form.get("image");
      if (!photo || typeof photo === "string" || !photo.size || photo.size > 10 * 1024 * 1024) return fail("Upload a JPG, PNG or WEBP photo up to 10 MB.", 400);
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const mime = imageMime(bytes);
      if (!mime || mime !== photo.type) return fail("Invalid photo format. Use JPG, PNG or WEBP.", 400);

      parameters = settings;
      const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
      sourceKey = `kitchen-design/${user}/${runId}/source.${extension}`;
      inputKey = sourceKey;
      upload = { bytes, mime };
      prompt = kitchenPrompt(settings);
    }
    const id = runId;
    enterStage("claim_generation_and_credit");
    const rejection = await db().transaction(async (tx) => {
      await lockCredits(tx, user);
      const abandoned = await tx.update(kitchenGenerations).set({ status: "failed", updated_at: new Date() })
        .where(and(eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing"), lt(kitchenGenerations.created_at, new Date(Date.now() - 10 * 60_000))))
        .returning({ id: kitchenGenerations.uuid });
      if (abandoned.length) {
        await tx.delete(credits).where(and(
          eq(credits.user_uuid, user),
          eq(credits.trans_type, CreditsTransType.KitchenDesign),
          inArray(credits.trans_no, abandoned.map((job) => `kitchen:${job.id}`)),
        ));
      }
      const [existing] = await tx.select().from(kitchenGenerations).where(eq(kitchenGenerations.uuid, id)).limit(1);
      if (existing) {
        if (existing.user_uuid !== user) return fail("Request unavailable.", 404);
        if (existing.status === "completed") return savedResult(id, existing.parameters, isRefinement);
        return existing.status === "processing"
          ? fail("This design is still generating. Check Previous Results shortly.", 409)
          : fail(
            isRefinement ? "The previous edit failed. Select Apply changes to try again." : "This generation failed. Start a new generation.",
            422,
          );
      }
      const [claimed] = await tx.insert(kitchenGenerations).values({ uuid: id, user_uuid: user, status: "processing", source_key: sourceKey, parameters, prompt, model: provider.model }).onConflictDoNothing().returning();
      if (!claimed) return fail("A design is already generating. Please wait for it to finish.", 409);
      if (!(await spendCredits(tx, user, KITCHEN_DESIGN_CREDIT_COST, CreditsTransType.KitchenDesign, `kitchen:${id}`))) {
        await tx.delete(kitchenGenerations).where(eq(kitchenGenerations.uuid, id));
        const [pending] = await tx.select({ id: kitchenGenerations.uuid }).from(kitchenGenerations)
          .where(and(eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing"))).limit(1);
        if (pending) return fail("Your last credit is in use. Wait for the current design to finish.", 409);
        return fail("You’re out of credits. Choose a plan to continue.", 402);
      }
      return null;
    });
    if (rejection) return rejection;
    ownsRun = true;
    const prefix = `kitchen-design/${user}/${id}`;
    if (upload) {
      enterStage("upload_source_to_supabase");
      await storage.upload(sourceKey, upload.bytes, upload.mime);
    }
    enterStage("sign_source_url");
    const sourceUrl = await storage.createSignedUrl(inputKey);
    enterStage("replicate_generate_and_download");
    const result = await provider.generate(
      prompt,
      sourceUrl,
      isRefinement ? { timeoutSeconds: 200, promptUpsampling: false } : undefined,
    );
    enterStage("validate_result_image");
    if (imageMime(result) !== "image/png") throw new Error("Invalid generated PNG");
    const resultKey = `${prefix}/result.png`;
    enterStage("upload_result_to_supabase");
    await storage.upload(resultKey, result, "image/png");
    enterStage("save_completed_generation");
    const [completed] = await db().update(kitchenGenerations)
      .set({ status: "completed", result_key: resultKey, updated_at: new Date() })
      .where(and(eq(kitchenGenerations.uuid, runId), eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing")))
      .returning({ id: kitchenGenerations.uuid });
    if (!completed) throw new Error("Kitchen generation is no longer active.");
    return savedResult(runId, parameters, isRefinement);
  } catch (error) {
    // Capture before cleanup so refund/database latency does not obscure the failure.
    const failedAt = Date.now();
    const networkCodes: string[] = [];
    let cause: unknown = error;
    // Log codes only: nested fetch causes may contain signed URLs or other credentials.
    for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
      const details = cause as { code?: unknown; cause?: unknown };
      if (typeof details.code === "string" && /^[A-Z0-9_]{1,80}$/.test(details.code)) {
        networkCodes.push(details.code);
      }
      cause = details.cause;
    }
    console.error("Kitchen generation failed", {
      runId,
      stage,
      stageElapsedMs: failedAt - stageStartedAt,
      elapsedMs: failedAt - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
      ...(error instanceof KitchenReplicateError ? {
        providerStage: error.stage,
        predictionId: error.predictionId,
        providerElapsedMs: error.elapsedMs,
      } : {}),
      ...(networkCodes.length ? { networkCodes } : {}),
    });
    if (ownsRun && runId) {
      const id = runId;
      await db().transaction(async (tx) => {
        await lockCredits(tx, user);
        const [failed] = await tx.update(kitchenGenerations).set({ status: "failed", updated_at: new Date() })
          .where(and(eq(kitchenGenerations.uuid, id), eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing")))
          .returning({ id: kitchenGenerations.uuid });
        if (failed) await tx.delete(credits).where(and(
          eq(credits.user_uuid, user),
          eq(credits.trans_type, CreditsTransType.KitchenDesign),
          eq(credits.trans_no, `kitchen:${id}`),
        ));
      }).catch(() => console.error("Could not release kitchen credit", { runId: id }));
    }
    if (!ownsRun && (error instanceof z.ZodError || error instanceof SyntaxError)) return fail("Invalid design settings.", 400);
    return fail("Could not generate and save the design. Please check History before trying again.", 503);
  }
}
