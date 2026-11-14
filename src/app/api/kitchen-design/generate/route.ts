import { and, desc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenStorage } from "@/services/kitchen-supabase-storage";
import { kitchenReplicate } from "@/services/kitchen-replicate";
import { imageMime, kitchenParameters, kitchenPrompt } from "@/services/kitchen-design";
import { hasRequestedAreaChange, selectedAreasRequired } from "@/components/kitchen-design/data";

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
      summary: settings.success ? `${settings.data.designStyle} · ${settings.data.designScope}` : "Kitchen design",
    },
  });
}

export async function POST(request: Request) {
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
      if (settings.designScope === "Selected Areas" && !hasRequestedAreaChange(settings)) {
        return fail(selectedAreasRequired, 400);
      }
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
    // Expire abandoned jobs before checking a retry of the same request.
    await db().update(kitchenGenerations).set({ status: "failed", updated_at: new Date() }).where(and(eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing"), lt(kitchenGenerations.created_at, new Date(Date.now() - 10 * 60_000))));
    const [existing] = await db().select().from(kitchenGenerations).where(eq(kitchenGenerations.uuid, runId)).limit(1);
    if (existing) {
      if (existing.user_uuid !== user) return fail("Request unavailable.", 404);
      if (existing.status === "completed") return savedResult(runId, existing.parameters, isRefinement);
      return existing.status === "processing"
        ? fail("This design is still generating. Check Previous Results shortly.", 409)
        : fail(
          isRefinement ? "The previous edit failed. Select Apply changes to try again." : "This generation failed. Start a new generation.",
          isRefinement ? 422 : 409,
        );
    }
    const recent = await db().select({ uuid: kitchenGenerations.uuid }).from(kitchenGenerations).where(and(eq(kitchenGenerations.user_uuid, user), gte(kitchenGenerations.created_at, new Date(Date.now() - 3600_000)))).orderBy(desc(kitchenGenerations.created_at)).limit(10);
    if (recent.length >= 10) return fail("Generation limit reached. Please try again later.", 429);
    const model = provider.model;
    const prefix = `kitchen-design/${user}/${runId}`;
    const [claimed] = await db().insert(kitchenGenerations).values({ uuid: runId, user_uuid: user, status: "processing", source_key: sourceKey, parameters, prompt, model }).onConflictDoNothing().returning();
    if (!claimed) return fail("A design is already generating. Please wait for it to finish.", 409);
    ownsRun = true;
    if (upload) await storage.upload(sourceKey, upload.bytes, upload.mime);
    const result = await provider.generate(
      prompt,
      await storage.createSignedUrl(inputKey),
      isRefinement ? { timeoutSeconds: 200, promptUpsampling: false } : undefined,
    );
    if (imageMime(result) !== "image/png") throw new Error("Invalid generated PNG");
    const resultKey = `${prefix}/result.png`;
    await storage.upload(resultKey, result, "image/png");
    const [completed] = await db().update(kitchenGenerations)
      .set({ status: "completed", result_key: resultKey, updated_at: new Date() })
      .where(and(eq(kitchenGenerations.uuid, runId), eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing")))
      .returning({ id: kitchenGenerations.uuid });
    if (!completed) throw new Error("Kitchen generation is no longer active.");
    return savedResult(runId, parameters, isRefinement);
  } catch (error) {
    if (ownsRun && runId) {
      await db().update(kitchenGenerations).set({ status: "failed", updated_at: new Date() }).where(and(eq(kitchenGenerations.uuid, runId), eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing"))).catch(() => undefined);
    }
    if (!ownsRun && (error instanceof z.ZodError || error instanceof SyntaxError)) return fail("Invalid design settings.", 400);
    console.error("Kitchen generation failed", { runId, message: error instanceof Error ? error.message : "Unknown error" });
    return fail("Could not generate and save the design. Please check History before trying again.", 503);
  }
}
