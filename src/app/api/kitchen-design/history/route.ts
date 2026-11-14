import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kitchenGenerations } from "@/db/schema";
import { getUserUuid } from "@/services/user";
import { kitchenParameters } from "@/services/kitchen-design";

export async function GET() {
  try {
    const user = await getUserUuid();
    if (!user) return Response.json({ code: -1, message: "Sign in to view your saved designs." }, { status: 401 });
    const rows = await db().select().from(kitchenGenerations).where(and(eq(kitchenGenerations.user_uuid, user), eq(kitchenGenerations.status, "completed"))).orderBy(desc(kitchenGenerations.created_at)).limit(50);
    return Response.json({ code: 0, data: rows.map(row => {
      const settings = kitchenParameters.safeParse(row.parameters);
      return { id: row.uuid, createdAt: row.created_at.toISOString(), results: [{ id: row.uuid, url: `/api/kitchen-design/images/${row.uuid}?kind=result` }], originalImage: { name: "Kitchen photo", url: `/api/kitchen-design/images/${row.uuid}?kind=source` }, parameters: settings.success ? settings.data : undefined, summary: settings.success ? settings.data.designStyle : "Kitchen design" };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ code: -1, message: "Could not load saved designs." }, { status: 503 });
  }
}
