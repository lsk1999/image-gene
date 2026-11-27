import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { credits, orders, paymentEvents } from "@/db/schema";
import { refundedCredits } from "@/lib/waffo";

type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];

// Caller holds lockCredits(userId). Also called after a failed generation releases
// a reserved credit, so that credit cannot reappear after its purchase was refunded.
export async function reclaimWaffoRefundCredits(
  tx: Transaction,
  userId: string,
  orderNos: string[],
) {
  const ids = [...new Set(orderNos.filter(Boolean))];
  if (!ids.length) return;
  const purchases = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.user_uuid, userId), inArray(orders.order_no, ids)));
  for (const order of purchases) {
    if (
      !order.paid_detail ||
      !order.expired_at ||
      !["paid", "refunded"].includes(order.status)
    )
      continue;
    const refunds = await tx
      .select()
      .from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.order_no, order.order_no),
          eq(paymentEvents.event_type, "refund.succeeded"),
          eq(paymentEvents.payment_id, order.paid_detail),
        ),
      );
    if (!refunds.length) continue;
    const charged = refunds[0].charged_cents;
    if (refunds.some((refund) => refund.charged_cents !== charged))
      throw new Error("Inconsistent refund total.");
    const target = refundedCredits(
      order.credits,
      refunds.reduce((sum, refund) => sum + refund.refunded_cents, 0),
      charged,
    );
    const [ledger] = await tx
      .select({
        available: sql<number>`coalesce(sum(${credits.credits}), 0)::int`,
        revoked: sql<number>`coalesce(sum(-${credits.credits}) filter (where ${credits.trans_type} = 'order_refund'), 0)::int`,
      })
      .from(credits)
      .where(
        and(
          eq(credits.user_uuid, userId),
          eq(credits.order_no, order.order_no),
        ),
      );
    const revoke = Math.min(
      Math.max(0, ledger.available),
      Math.max(0, target - ledger.revoked),
    );
    if (revoke)
      await tx.insert(credits).values({
        trans_no: `waffo-refund:${crypto.randomUUID()}`,
        user_uuid: userId,
        trans_type: "order_refund",
        credits: -revoke,
        order_no: order.order_no,
        created_at: new Date(),
        expired_at: order.expired_at,
      });
  }
}
