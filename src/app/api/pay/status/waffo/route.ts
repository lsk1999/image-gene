import { getUserUuid } from "@/services/user";
import { findOrderByOrderNo } from "@/models/order";
import { readWaffoBinding } from "@/integrations/waffo";

export async function GET(request: Request) {
  try {
    const user = await getUserUuid();
    if (!user)
      return Response.json(
        { message: "Sign in to check your purchase." },
        { status: 401 },
      );
    const id = new URL(request.url).searchParams.get("order_no");
    const order =
      id && id.length <= 128 ? await findOrderByOrderNo(id) : undefined;
    if (
      !order ||
      order.user_uuid !== user ||
      !readWaffoBinding(order.order_detail)
    )
      return new Response(null, { status: 404 });
    return Response.json(
      { status: order.status },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new Response(null, { status: 503 });
  }
}
