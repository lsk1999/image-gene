import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenParameters } from "@/services/kitchen-design";
import { KITCHEN_HISTORY_LIMIT } from "@/components/kitchen-design/data";

export async function GET(request: Request) {
  try {
    const user = await getUserUuid();
    if (!user) return Response.json({ code: -1, message: "Sign in to view your saved designs." }, { status: 401 });
    const cursor = new URL(request.url).searchParams.get("cursor");
    let boundary;
    if (cursor !== null) {
      if (!z.string().uuid().safeParse(cursor).success) {
        return Response.json({ code: -1, message: "Invalid history cursor." }, { status: 400 });
      }
      // Preserve PostgreSQL timestamp precision when multiple rows share a millisecond.
      const [anchor] = await db().select({
        createdAt: sql<string>`${kitchenGenerations.created_at}::text`,
        id: kitchenGenerations.uuid,
      }).from(kitchenGenerations).where(and(
        eq(kitchenGenerations.uuid, cursor),
        eq(kitchenGenerations.user_uuid, user),
        eq(kitchenGenerations.status, "completed"),
      )).limit(1);
      if (!anchor) return Response.json({ code: -1, message: "History cursor unavailable. Refresh saved results." }, { status: 400 });
      const timestamp = sql`${anchor.createdAt}::timestamptz`;
      boundary = or(
        lt(kitchenGenerations.created_at, timestamp),
        and(eq(kitchenGenerations.created_at, timestamp), lt(kitchenGenerations.uuid, anchor.id)),
      );
    }
    const rows = await db().select({
      uuid: kitchenGenerations.uuid, created_at: kitchenGenerations.created_at,
      parameters: kitchenGenerations.parameters,
    }).from(kitchenGenerations).where(and(
      eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "completed"), boundary,
    )).orderBy(desc(kitchenGenerations.created_at), desc(kitchenGenerations.uuid)).limit(KITCHEN_HISTORY_LIMIT + 1);
    const page = rows.slice(0, KITCHEN_HISTORY_LIMIT);
    const nextCursor = rows.length > KITCHEN_HISTORY_LIMIT ? page[page.length - 1].uuid : null;
    return Response.json({ code: 0, nextCursor, data: page.map(row => {
      const settings = kitchenParameters.safeParse(row.parameters);
      return { id: row.uuid, createdAt: row.created_at.toISOString(), results: [{ id: row.uuid, url: `/api/kitchen-design/images/${row.uuid}?kind=result` }], originalImage: { name: "Kitchen photo", url: `/api/kitchen-design/images/${row.uuid}?kind=source` }, parameters: settings.success ? settings.data : undefined, summary: settings.success ? settings.data.designStyle : "Kitchen design" };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ code: -1, message: "Could not load saved designs." }, { status: 503 });
  }
}
