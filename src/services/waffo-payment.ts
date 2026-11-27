import "server-only";
import { TaxCategory, type WebhookEvent } from "@waffo/pancake-ts";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { credits, orders, paymentEvents } from "@/db/schema";
import {
  readWaffoBinding,
  waffoClient,
  waffoConfig,
} from "@/integrations/waffo";
import { refundedCredits, usdCents } from "@/lib/waffo";
import { lockCredits, CreditsTransType } from "@/services/credit";
import { addCalendarMonths } from "@/lib/time";
import { OrderStatus, updateOrderSession } from "@/models/order";
import { reclaimWaffoRefundCredits } from "@/services/waffo-refund-credit";

export async function createWaffoCheckout(
  order: typeof orders.$inferSelect,
  locale: string,
) {
  const config = waffoConfig();
  if (
    order.interval !== "one-time" ||
    order.currency?.toUpperCase() !== "USD" ||
    order.credits < 1 ||
    !order.valid_months
  )
    throw new Error("Invalid Waffo credit pack.");
  const products = z
    .record(z.string().min(1))
    .parse(JSON.parse(process.env.WAFFO_PRODUCTS || "{}"));
  const productId = products[order.product_id || ""];
  if (!productId) throw new Error("Missing Waffo product mapping.");
  const nonce = crypto.randomUUID();
  const site = new URL(process.env.NEXT_PUBLIC_WEB_URL || "");
  if (
    (site.protocol !== "https:" &&
      !(site.protocol === "http:" && site.hostname === "localhost")) ||
    site.username ||
    site.password
  )
    throw new Error("Invalid site URL.");
  const success = new URL(
    `${locale === "zh" ? "/zh" : ""}/payment-status`,
    site,
  );
  success.searchParams.set("order_no", order.order_no);
  const client = waffoClient();
  // Confirm the mapped ID belongs to this store and has the advertised price.
  const catalog = await client.graphql.query<unknown>({
    query: `query($storeId: String!) {
    store(id: $storeId) { id prodEnabled onetimeProducts { id status prices { currency priceInfo { amount taxCategory } } } }
  }`,
    variables: { storeId: config.storeId },
  });
  if (catalog.errors?.length) throw new Error("Waffo product lookup failed.");
  const store = z
    .object({
      store: z.object({
        id: z.string(),
        prodEnabled: z.boolean(),
        onetimeProducts: z.array(
          z.object({
            id: z.string(),
            status: z.string(),
            prices: z.array(
              z.object({
                currency: z.string(),
                priceInfo: z.object({
                  amount: z.string(),
                  taxCategory: z.string(),
                }),
              }),
            ),
          }),
        ),
      }),
    })
    .parse(catalog.data).store;
  const product = store.onetimeProducts.find((item) => item.id === productId);
  const price = product?.prices.find(
    (item) => item.currency === "USD",
  )?.priceInfo;
  if (
    store.id !== config.storeId ||
    (config.mode === "prod" && !store.prodEnabled) ||
    product?.status !== "active" ||
    !price ||
    usdCents(price.amount) !== order.amount ||
    price.taxCategory !== TaxCategory.SaaS
  )
    throw new Error("Waffo catalog does not match this credit pack.");
  const session = await client.checkout.authenticated.create(
    {
      productId,
      currency: "USD",
      buyerIdentity: order.user_uuid,
      buyerEmail: order.user_email,
      orderMerchantExternalId: order.order_no,
      successUrl: success.href,
      // Price is taken only from the server's pricing configuration.
      priceSnapshot: {
        amount: (order.amount / 100).toFixed(2),
        taxCategory: TaxCategory.SaaS,
      },
      metadata: {
        kitchen_order_no: order.order_no,
        kitchen_product_id: productId,
        kitchen_nonce: nonce,
      },
      allowPromotionCodes: false,
      expiresInSeconds: 3600,
    },
    { idempotencyKey: `kitchen-checkout:${order.order_no}` },
  );
  const url = new URL(session.checkoutUrl);
  if (
    !session.sessionId ||
    url.protocol !== "https:" ||
    url.username ||
    url.password
  )
    throw new Error("Invalid Waffo checkout URL.");
  const binding = { provider: "waffo", ...config, productId, nonce };
  await updateOrderSession(
    order.order_no,
    session.sessionId,
    JSON.stringify(binding),
  );
  return {
    order_no: order.order_no,
    session_id: session.sessionId,
    checkout_url: session.checkoutUrl,
  };
}

const identity = z.object({
  orderId: z.string().min(1),
  orderMerchantExternalId: z.string().min(1),
  currency: z.literal("USD"),
  paymentId: z.string().min(1).max(128),
  merchantProvidedBuyerIdentity: z.string().min(1),
  orderMetadata: z.object({
    kitchen_order_no: z.string(),
    kitchen_product_id: z.string(),
    kitchen_nonce: z.string(),
  }),
});

export async function handleWaffoEvent(
  event: WebhookEvent<Record<string, unknown>>,
) {
  const config = waffoConfig();
  if (event.storeId !== config.storeId || event.mode !== config.mode)
    throw new Error("Waffo store or environment mismatch.");
  if (
    !["order.completed", "refund.succeeded", "refund.failed"].includes(
      event.eventType,
    )
  )
    return;
  if (
    !event.data?.orderMetadata ||
    !(event.data.orderMetadata as Record<string, unknown>).kitchen_order_no
  )
    return;
  const data = identity.parse(event.data);
  const isRefund = event.eventType.startsWith("refund.");
  const failedRefund = event.eventType === "refund.failed";
  const amounts =
    isRefund && !failedRefund
      ? z
          .object({
            originalChargedAmount: z.string(),
            refundedAmount: z.string(),
            refundStatus: z.literal("succeeded"),
          })
          .parse(event.data)
      : undefined;
  const chargedCents = failedRefund
    ? 0
    : usdCents(
        amounts?.originalChargedAmount ??
          z.object({ chargedAmount: z.string() }).parse(event.data)
            .chargedAmount,
      );
  const refundCents = amounts ? usdCents(amounts.refundedAmount) : 0;
  if (
    !failedRefund &&
    (chargedCents <= 0 ||
      chargedCents > 2147483647 ||
      (isRefund && (refundCents <= 0 || refundCents > chargedCents)))
  )
    throw new Error("Invalid Waffo payment amounts.");
  const eventKey = `${event.mode}:${event.storeId}:${event.eventType}:${event.eventId}`;
  await db().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.order_no, data.orderMerchantExternalId))
      .for("update");
    const binding = order && readWaffoBinding(order.order_detail);
    if (
      !order ||
      !binding ||
      binding.storeId !== event.storeId ||
      binding.mode !== event.mode ||
      data.orderMetadata.kitchen_order_no !== order.order_no ||
      data.orderMetadata.kitchen_product_id !== binding.productId ||
      data.orderMetadata.kitchen_nonce !== binding.nonce ||
      data.merchantProvidedBuyerIdentity !== order.user_uuid ||
      order.currency?.toUpperCase() !== "USD" ||
      !order.stripe_session_id
    )
      throw new Error("Waffo order binding mismatch.");
    if (order.paid_detail && order.paid_detail !== data.paymentId)
      throw new Error("Waffo payment ID mismatch.");
    const [record] = await tx
      .insert(paymentEvents)
      .values({
        event_key: eventKey,
        order_no: order.order_no,
        event_type: event.eventType,
        payment_id: data.paymentId,
        charged_cents: chargedCents,
        refunded_cents: refundCents,
        payload: event,
      })
      .onConflictDoNothing()
      .returning();
    if (!record) return;
    if (event.eventType === "refund.failed") return;
    await lockCredits(tx, order.user_uuid);
    const refunds = await tx
      .select()
      .from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.order_no, order.order_no),
          eq(paymentEvents.event_type, "refund.succeeded"),
        ),
      );
    if (
      refunds.some(
        (refund) =>
          refund.payment_id !== data.paymentId ||
          refund.charged_cents !== chargedCents,
      )
    )
      throw new Error("Waffo refund payment mismatch.");
    const refundedCents = refunds.reduce(
      (total, refund) => total + refund.refunded_cents,
      0,
    );
    refundedCredits(order.credits, refundedCents, chargedCents); // Validate the cumulative refund ceiling before committing.
    if (event.eventType === "order.completed") {
      const payment = z
        .object({
          orderStatus: z.literal("completed"),
          paymentStatus: z.literal("succeeded"),
          paymentId: z.string().min(1),
          merchantProvidedBuyerIdentity: z.string(),
          currency: z.literal("USD"),
          chargedAmount: z.string(),
          listPrice: z.object({
            total: z.string(),
            subtotal: z.string(),
            taxAmount: z.string(),
            discountAmount: z.string().optional(),
          }),
        })
        .parse(event.data);
      if (
        payment.merchantProvidedBuyerIdentity !== order.user_uuid ||
        order.currency?.toUpperCase() !== "USD" ||
        usdCents(payment.listPrice.subtotal) !== order.amount ||
        usdCents(payment.chargedAmount) !== usdCents(payment.listPrice.total) ||
        usdCents(payment.listPrice.total) !==
          order.amount + usdCents(payment.listPrice.taxAmount) ||
        (payment.listPrice.discountAmount &&
          usdCents(payment.listPrice.discountAmount) !== 0)
      )
        throw new Error("Waffo payment does not match purchased pack.");
      if (
        order.status === OrderStatus.Paid ||
        (order.status === "refunded" && order.paid_detail)
      ) {
        return;
      }
      if (
        order.status !== OrderStatus.Created ||
        !order.valid_months ||
        order.credits < 1
      )
        throw new Error("Invalid Waffo order state.");
      const paidAt = new Date();
      const expiresAt = addCalendarMonths(paidAt, order.valid_months);
      await tx
        .insert(credits)
        .values({
          trans_no: `order:${order.order_no}`,
          user_uuid: order.user_uuid,
          trans_type: CreditsTransType.OrderPay,
          credits: order.credits,
          order_no: order.order_no,
          created_at: paidAt,
          expired_at: expiresAt,
        });
      await tx
        .update(orders)
        .set({
          status: OrderStatus.Paid,
          paid_at: paidAt,
          paid_email: order.user_email,
          paid_detail: payment.paymentId,
          expired_at: expiresAt,
        })
        .where(eq(orders.order_no, order.order_no));
    } else if (
      order.status !== OrderStatus.Paid &&
      order.status !== "refunded"
    ) {
      // Persist early refunds; completion will deliver only the remaining entitlement.
      return;
    }
    await reclaimWaffoRefundCredits(tx, order.user_uuid, [order.order_no]);
    if (refundedCents === chargedCents)
      await tx
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.order_no, order.order_no));
  });
}
