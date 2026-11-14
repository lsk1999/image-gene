import { and, desc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenStorage } from "@/services/kitchen-supabase-storage";
import { kitchenReplicate } from "@/services/kitchen-replicate";
import { imageMime, kitchenParameters, kitchenPrompt } from "@/services/kitchen-design";

export const maxDuration = 300;
const fail = (message: string, status: number) => Response.json({ code: -1, message }, { status });

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
    const form = await request.formData();
    runId = z.string().uuid().parse(form.get("requestId"));
    const parameters = kitchenParameters.parse(JSON.parse(String(form.get("parameters"))));
    const photo = form.get("image");
    // Node 19 及更早版本没有全局 File，这里用结构判断，避免 instanceof File 抛 ReferenceError。
    if (!photo || typeof photo === "string" || !photo.size || photo.size > 10 * 1024 * 1024) return fail("Upload a JPG, PNG or WEBP photo up to 10 MB.", 400);
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime || mime !== photo.type) return fail("Invalid photo format. Use JPG, PNG or WEBP.", 400);
    const [existing] = await db().select().from(kitchenGenerations).where(eq(kitchenGenerations.uuid, runId)).limit(1);
    if (existing) {
      if (existing.user_uuid !== user) return fail("Request unavailable.", 404);
      if (existing.status === "completed") return Response.json({ code: 0, data: { id: runId, url: `/api/kitchen-design/images/${runId}?kind=result` } });
      return fail(existing.status === "processing" ? "This design is still generating. Check History shortly." : "This generation failed. Start a new generation.", 409);
    }
    // Expired jobs no longer block a user after a process crash or deployment.
    await db().update(kitchenGenerations).set({ status: "failed", updated_at: new Date() }).where(and(eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "processing"), lt(kitchenGenerations.created_at, new Date(Date.now() - 10 * 60_000))));
    const recent = await db().select({ uuid: kitchenGenerations.uuid }).from(kitchenGenerations).where(and(eq(kitchenGenerations.user_uuid, user), gte(kitchenGenerations.created_at, new Date(Date.now() - 3600_000)))).orderBy(desc(kitchenGenerations.created_at)).limit(10);
    if (recent.length >= 10) return fail("Generation limit reached. Please try again later.", 429);
    const model = provider.model;
    const prefix = `kitchen-design/${user}/${runId}`;
    const sourceKey = `${prefix}/source.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`;
    const prompt = kitchenPrompt(parameters);
    const [claimed] = await db().insert(kitchenGenerations).values({ uuid: runId, user_uuid: user, status: "processing", source_key: sourceKey, parameters, prompt, model }).onConflictDoNothing().returning();
    if (!claimed) return fail("A design is already generating. Please wait for it to finish.", 409);
    ownsRun = true;
    await storage.upload(sourceKey, bytes, mime);
    const result = await provider.generate(prompt, await storage.createSignedUrl(sourceKey));
    if (imageMime(result) !== "image/png") throw new Error("Invalid generated PNG");
    const resultKey = `${prefix}/result.png`;
    await storage.upload(resultKey, result, "image/png");
    await db().update(kitchenGenerations).set({ status: "completed", result_key: resultKey, updated_at: new Date() }).where(and(eq(kitchenGenerations.uuid, runId), eq(kitchenGenerations.user_uuid, user)));
    return Response.json({ code: 0, data: { id: runId, url: `/api/kitchen-design/images/${runId}?kind=result` } });
  } catch (error) {
    if (ownsRun && runId) {
      await db().update(kitchenGenerations).set({ status: "failed", updated_at: new Date() }).where(and(eq(kitchenGenerations.uuid, runId), eq(kitchenGenerations.user_uuid, user))).catch(() => undefined);
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("Invalid design settings.", 400);
    console.error("Kitchen generation failed", { runId, message: error instanceof Error ? error.message : "Unknown error" });
    return fail("Could not generate and save the design. Please check History before trying again.", 503);
  }
}
