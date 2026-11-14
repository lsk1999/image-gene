import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenStorage } from "@/services/kitchen-supabase-storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserUuid();
    if (!user) return new Response("Unauthorized", { status: 401 });
    const { id } = await context.params;
    const [row] = await db().select().from(kitchenGenerations).where(and(eq(kitchenGenerations.uuid, id), eq(kitchenGenerations.user_uuid, user))).limit(1);
    if (!row) return new Response("Not found", { status: 404 });
    const key = new URL(request.url).searchParams.get("kind") === "source" ? row.source_key : row.result_key;
    if (!key) return new Response("Not found", { status: 404 });
    const response = await kitchenStorage().download(key);
    return new Response(response.body, { headers: { "Content-Type": response.headers.get("Content-Type") || "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}
